/**
 * RL-based AI Controller.
 * Builds observations from game state, sends to ONNX worker for inference,
 * and decodes actions into orders. Port of Python obs_builder.py and alkaid_env.py.
 */

import type { UnitManager } from '../units/UnitManager';
import type { Unit } from '../units/Unit';
import type { CommandSystem } from '../command/CommandSystem';
import type { Order } from '../OrderManager';
import type { OrderManager } from '../OrderManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import type { SurrenderSystem } from '../combat/SurrenderSystem';
import { OnnxWorkerClient } from '../../workers/OnnxWorkerClient';
import {
  RL_OBS_SIZE,
  RL_MAX_UNITS,
  RL_UNIT_FEATURES,
  RL_DECISION_INTERVAL,
  RL_TARGET_X_BINS,
  RL_TARGET_Y_BINS,
  DEFAULT_MAP_WIDTH,
  DEFAULT_MAP_HEIGHT,
  TILE_SIZE,
} from '../../constants';
import sharedConstants from '../../../shared/constants.json';

const UNIT_STATE_DEAD = 5;
const UNIT_STATE_ROUTING = 4;
const NUM_UNIT_TYPES = 14;
const NUM_STATES = 6;

const MAP_W_PX = DEFAULT_MAP_WIDTH * TILE_SIZE;
const MAP_H_PX = DEFAULT_MAP_HEIGHT * TILE_SIZE;

const unitTypeConfigs = sharedConstants.unitTypeConfigs as Record<string, {
  category: number; maxSize: number; hpPerSoldier: number;
  damage: number; attackSpeed: number; range: number;
  armor: number; armorPen: number; speed: number; cost: number;
}>;

export class RLController {
  private team: number;
  private onnxClient: OnnxWorkerClient;
  private lastDecisionTick = -999;
  private inferring = false;
  private temperature = 1.0;
  private decisionIntervalMult = 1.0;

  constructor(team: number, onnxClient: OnnxWorkerClient) {
    this.team = team;
    this.onnxClient = onnxClient;
  }

  /** Set temperature for action sampling (higher = more random = easier). */
  setTemperature(temp: number): void {
    this.temperature = Math.max(0.1, temp);
  }

  /** Scale the decision interval (>1 = slower decisions = easier). */
  setDecisionIntervalMult(mult: number): void {
    this.decisionIntervalMult = Math.max(0.1, mult);
  }

  async tick(
    currentTick: number,
    unitManager: UnitManager,
    commandSystem: CommandSystem,
    _orderManager: OrderManager,
    supplySystem: SupplySystem,
    surrenderSystem: SurrenderSystem,
    env: EnvironmentState | null,
    isPaused: boolean,
  ): Promise<void> {
    if (isPaused) return;
    if (this.inferring) return;
    const effectiveInterval = Math.round(RL_DECISION_INTERVAL * this.decisionIntervalMult);
    if (currentTick - this.lastDecisionTick < effectiveInterval) return;
    if (!this.onnxClient.isReady()) return;

    this.lastDecisionTick = currentTick;
    this.inferring = true;

    try {
      const obs = this.buildObservation(unitManager, supplySystem, surrenderSystem, env, currentTick);
      const actions = await this.onnxClient.infer(obs, this.temperature);
      this.decodeAndDispatch(actions, unitManager, commandSystem, isPaused);
    } catch (err) {
      console.warn('RL inference failed:', err);
    } finally {
      this.inferring = false;
    }
  }

  /**
   * Build flat Float32Array observation matching Python obs_builder.py format.
   */
  private buildObservation(
    unitManager: UnitManager,
    supplySystem: SupplySystem,
    surrenderSystem: SurrenderSystem,
    env: EnvironmentState | null,
    currentTick: number,
  ): Float32Array {
    const obs = new Float32Array(RL_OBS_SIZE);

    const allUnits: Unit[] = unitManager.getAllArray();
    const ownUnits = allUnits
      .filter((u: Unit) => u.team === this.team && u.state !== UNIT_STATE_DEAD)
      .sort((a: Unit, b: Unit) => a.id - b.id);
    const enemyUnits = allUnits
      .filter((u: Unit) => u.team !== this.team && u.state !== UNIT_STATE_DEAD)
      .sort((a: Unit, b: Unit) => a.id - b.id);

    // Own units (32 slots × 40 features)
    let offset = 0;
    for (let i = 0; i < RL_MAX_UNITS; i++) {
      if (i < ownUnits.length) {
        this.encodeUnit(obs, offset, ownUnits[i]);
      }
      offset += RL_UNIT_FEATURES;
    }

    // Enemy units (32 slots × 40 features)
    for (let i = 0; i < RL_MAX_UNITS; i++) {
      if (i < enemyUnits.length) {
        this.encodeUnit(obs, offset, enemyUnits[i]);
      }
      offset += RL_UNIT_FEATURES;
    }

    // Global features (22)
    this.encodeGlobal(obs, offset, allUnits, supplySystem, surrenderSystem, env, currentTick);

    return obs;
  }

  /**
   * Encode single unit into 40 features. Matches _encode_unit_v2 in Python.
   */
  private encodeUnit(obs: Float32Array, offset: number, unit: Unit): void {
    let i = offset;
    const cfg = unitTypeConfigs[String(unit.type)];

    // Continuous features (10)
    obs[i++] = unit.x / MAP_W_PX;
    obs[i++] = unit.y / MAP_H_PX;
    obs[i++] = cfg.maxSize > 0 ? unit.size / cfg.maxSize : 0;
    const maxHp = cfg.maxSize * cfg.hpPerSoldier;
    obs[i++] = maxHp > 0 ? unit.hp / maxHp : 0;
    obs[i++] = (unit.morale ?? 70) / 100;
    obs[i++] = (unit.fatigue ?? 0) / 100;
    obs[i++] = (unit.experience ?? 0) / 100;
    obs[i++] = (unit.supply ?? 100) / 100;
    obs[i++] = ((unit.facing ?? 0) + Math.PI) / (2 * Math.PI);
    obs[i++] = cfg.speed / 3.0;

    // Unit type one-hot (14)
    if (unit.type >= 0 && unit.type < NUM_UNIT_TYPES) {
      obs[i + unit.type] = 1.0;
    }
    i += NUM_UNIT_TYPES;

    // State one-hot (6)
    if (unit.state >= 0 && unit.state < NUM_STATES) {
      obs[i + unit.state] = 1.0;
    }
    i += NUM_STATES;

    // Binary flags (3)
    obs[i++] = unit.isGeneral ? 1.0 : 0.0;
    obs[i++] = unit.hasCharged ? 1.0 : 0.0;
    obs[i++] = unit.combatTargetId !== undefined && unit.combatTargetId !== -1 ? 1.0 : 0.0;

    // Order type normalized (1)
    const order = unit.orderModifier ?? 0;
    obs[i++] = order / 8.0;

    // Additional features (6)
    obs[i++] = cfg.range / 10.0;
    obs[i++] = cfg.armor / 10.0;
    obs[i++] = cfg.damage / 25.0;
    obs[i++] = (unit.combatTicks ?? 0) / 100.0;
    obs[i++] = (unit.killCount ?? 0) / 50.0;
    obs[i++] = (unit.routTicks ?? 0) / 30.0;
    // Total: 10 + 14 + 6 + 3 + 1 + 6 = 40
  }

  /**
   * Encode 22 global features. Matches _encode_global in Python.
   */
  private encodeGlobal(
    obs: Float32Array,
    offset: number,
    allUnits: Unit[],
    supplySystem: SupplySystem,
    surrenderSystem: SurrenderSystem,
    env: EnvironmentState | null,
    currentTick: number,
  ): void {
    let i = offset;
    const enemyTeam = 1 - this.team;

    // General alive (2)
    const ownGeneral = allUnits.some(u => u.isGeneral && u.team === this.team && u.state !== UNIT_STATE_DEAD);
    const enemyGeneral = allUnits.some(u => u.isGeneral && u.team === enemyTeam && u.state !== UNIT_STATE_DEAD);
    obs[i++] = ownGeneral ? 1.0 : 0.0;
    obs[i++] = enemyGeneral ? 1.0 : 0.0;

    // Supply percentages (2)
    obs[i++] = (supplySystem.getFoodPercent?.(this.team) ?? 100) / 100;
    obs[i++] = (supplySystem.getFoodPercent?.(enemyTeam) ?? 100) / 100;

    // Weather one-hot (5)
    const weather = env?.weather ?? 0;
    if (weather >= 0 && weather < 5) {
      obs[i + weather] = 1.0;
    }
    i += 5;

    // Time of day one-hot (6)
    const tod = env?.timeOfDay ?? 1;
    if (tod >= 0 && tod < 6) {
      obs[i + tod] = 1.0;
    }
    i += 6;

    // Casualties (2) — approximate from current sizes vs max
    let ownStartTotal = 0, ownCurrentTotal = 0;
    let enemyStartTotal = 0, enemyCurrentTotal = 0;
    for (const u of allUnits) {
      const cfg = unitTypeConfigs[String(u.type)];
      if (u.team === this.team) {
        ownStartTotal += cfg.maxSize;
        ownCurrentTotal += u.state !== UNIT_STATE_DEAD ? u.size : 0;
      } else {
        enemyStartTotal += cfg.maxSize;
        enemyCurrentTotal += u.state !== UNIT_STATE_DEAD ? u.size : 0;
      }
    }
    obs[i++] = ownStartTotal > 0 ? (ownStartTotal - ownCurrentTotal) / ownStartTotal : 0;
    obs[i++] = enemyStartTotal > 0 ? (enemyStartTotal - enemyCurrentTotal) / enemyStartTotal : 0;

    // Squads routed (2) — approximate
    const ownRouted = allUnits.filter(u => u.team === this.team && u.state === UNIT_STATE_ROUTING).length;
    const enemyRouted = allUnits.filter(u => u.team === enemyTeam && u.state === UNIT_STATE_ROUTING).length;
    const ownTotal = Math.max(1, allUnits.filter(u => u.team === this.team).length);
    const enemyTotal = Math.max(1, allUnits.filter(u => u.team === enemyTeam).length);
    obs[i++] = ownRouted / ownTotal;
    obs[i++] = enemyRouted / enemyTotal;

    // Surrender pressure (2)
    obs[i++] = (surrenderSystem.getPressure?.(this.team) ?? 0) / 100;
    obs[i++] = (surrenderSystem.getPressure?.(enemyTeam) ?? 0) / 100;

    // Tick progress (1)
    obs[i++] = currentTick / 6000; // MAX_TICKS = 6000
    // Total: 2+2+5+6+2+2+2+1 = 22
  }

  /**
   * Decode ONNX output into game orders. Port of _decode_action from alkaid_env.py.
   */
  private decodeAndDispatch(
    actions: Int32Array,
    unitManager: UnitManager,
    commandSystem: CommandSystem,
    isPaused: boolean,
  ): void {
    const allUnits: Unit[] = unitManager.getAllArray();
    const ownUnits = allUnits
      .filter((u: Unit) => u.team === this.team && u.state !== UNIT_STATE_DEAD)
      .sort((a: Unit, b: Unit) => a.id - b.id);

    for (let i = 0; i < RL_MAX_UNITS && i < ownUnits.length; i++) {
      const unit = ownUnits[i];
      if (unit.state === UNIT_STATE_ROUTING) continue;

      const base = i * 3;
      const orderType = actions[base];
      const xBin = actions[base + 1];
      const yBin = actions[base + 2];

      // Skip NO_OP (order type 9 = no action)
      if (orderType >= 9) continue;

      // Convert bins to world coordinates
      const targetX = (xBin + 0.5) / RL_TARGET_X_BINS * MAP_W_PX;
      const targetY = (yBin + 0.5) / RL_TARGET_Y_BINS * MAP_H_PX;

      // Issue order through command system (messenger delay applies)
      const order: Order = {
        type: orderType as import('../../constants').OrderType,
        unitId: unit.id,
        targetX,
        targetY,
      };
      commandSystem.issueOrder(order, unitManager, isPaused);
    }
  }
}
