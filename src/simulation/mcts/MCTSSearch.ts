/**
 * Main MCTS search loop for BRUTAL difficulty.
 *
 * Uses the NN policy head for expansion priors and value head for evaluation.
 * Top-K (k=5) most likely full action vectors from the policy form child nodes.
 *
 * Performance target: 30 simulations in <500ms.
 * Each simulation: clone snapshot (~0.1ms) + NN inference (~5-10ms) + backprop (~0.01ms).
 */

import type { OnnxWorkerClient } from '../../workers/OnnxWorkerClient';
import { MCTSNode } from './MCTSNode';
import { MCTSSimulator } from './MCTSSimulator';
import { cloneSnapshot, type LightweightSnapshot, type LightweightUnit } from './LightweightSnapshot';
import {
  RL_OBS_SIZE,
  RL_MAX_UNITS,
  RL_UNIT_FEATURES,
  RL_TARGET_X_BINS,
  RL_TARGET_Y_BINS,
  RL_ORDER_TYPES,
  DEFAULT_MAP_WIDTH,
  DEFAULT_MAP_HEIGHT,
  TILE_SIZE,
} from '../../constants';
import sharedConstants from '../../../shared/constants.json';

const unitTypeConfigs = sharedConstants.unitTypeConfigs as Record<
  string,
  {
    category: number; maxSize: number; hpPerSoldier: number;
    damage: number; attackSpeed: number; range: number;
    armor: number; armorPen: number; speed: number; cost: number;
  }
>;

const UNIT_STATE_DEAD = 5;
const UNIT_STATE_ROUTING = 4;
const NUM_UNIT_TYPES = 14;
const NUM_STATES = 6;

const MAP_W_PX = DEFAULT_MAP_WIDTH * TILE_SIZE;
const MAP_H_PX = DEFAULT_MAP_HEIGHT * TILE_SIZE;

/** Number of top-K action candidates to expand per node. */
const TOP_K_ACTIONS = 5;

/** Number of ticks to simulate forward during expansion-phase rollout. */
const DEFAULT_ROLLOUT_DEPTH = 30;

export class MCTSSearch {
  private simulator: MCTSSimulator;
  private onnxClient: OnnxWorkerClient;
  private explorationConstant: number;
  private maxSimulations: number;
  private rolloutDepth: number;

  constructor(
    onnxClient: OnnxWorkerClient,
    explorationConstant = 1.41,
    maxSimulations = 30,
    rolloutDepth = DEFAULT_ROLLOUT_DEPTH,
  ) {
    this.simulator = new MCTSSimulator();
    this.onnxClient = onnxClient;
    this.explorationConstant = explorationConstant;
    this.maxSimulations = maxSimulations;
    this.rolloutDepth = rolloutDepth;
  }

  /**
   * Run MCTS search from the given snapshot.
   * Returns action array (Int32Array-compatible) for the best move found.
   */
  async search(snapshot: LightweightSnapshot, team: number): Promise<number[]> {
    const root = new MCTSNode(cloneSnapshot(snapshot), null, null, 1.0);

    for (let sim = 0; sim < this.maxSimulations; sim++) {
      // 1. SELECT: walk tree using UCB1 to find a leaf
      let node = root;
      while (!node.isLeaf()) {
        node = node.bestChild(this.explorationConstant);
      }

      // 2. EXPAND + EVALUATE
      let value: number;
      if (node.visits === 0 && node !== root) {
        // First visit to this leaf: just evaluate with NN, don't expand yet
        value = await this.evaluateWithNN(node.snapshot, team);
      } else {
        // Expand the node and get the NN value
        value = await this.expandAndEvaluate(node, team);
      }

      // 3. BACKPROPAGATE
      this.backpropagate(node, value);
    }

    // Return action from most-visited root child
    if (root.children.length === 0) {
      // Fallback: no expansion happened (shouldn't normally occur)
      // Run a single expansion and return best
      await this.expandAndEvaluate(root, team);
    }

    return root.bestAction();
  }

  /**
   * Expand a leaf node by generating TOP_K child action candidates.
   * Uses NN policy logits for priors, NN value head for evaluation.
   * Returns the NN value estimate.
   */
  private async expandAndEvaluate(node: MCTSNode, team: number): Promise<number> {
    const obs = this.buildObservationFromSnapshot(node.snapshot, team);

    let logits: Float32Array;
    let value: number;

    try {
      const result = await this.onnxClient.inferWithValue(obs, 1.0);
      logits = result.logits;
      value = result.value;
    } catch {
      // NN inference failed — use simulator evaluation as fallback
      return this.simulator.evaluatePosition(node.snapshot, team);
    }

    // Generate TOP_K action candidates from policy logits
    const candidates = this.generateTopKActions(logits);

    // Create child nodes
    for (const candidate of candidates) {
      const childSnap = cloneSnapshot(node.snapshot);
      this.simulator.applyActions(childSnap, candidate.actions, team);
      // Simulate a few ticks forward so the child represents a future state
      this.simulator.simulateForward(childSnap, this.rolloutDepth);

      const child = new MCTSNode(childSnap, node, candidate.actions, candidate.prior);
      node.children.push(child);
    }

    return value;
  }

  /** Evaluate a snapshot using only the NN value head (no expansion). */
  private async evaluateWithNN(snapshot: LightweightSnapshot, team: number): Promise<number> {
    const obs = this.buildObservationFromSnapshot(snapshot, team);

    try {
      const result = await this.onnxClient.inferWithValue(obs, 1.0);
      return result.value;
    } catch {
      return this.simulator.evaluatePosition(snapshot, team);
    }
  }

  /** Backpropagate value up the tree. */
  private backpropagate(node: MCTSNode | null, value: number): void {
    let current = node;
    while (current !== null) {
      current.visits++;
      current.totalValue += value;
      current = current.parent;
    }
  }

  /**
   * Generate TOP_K most likely full action vectors from policy logits.
   * Each action is 96 ints: 32 units * (orderType, xBin, yBin).
   *
   * Strategy: take the argmax action as candidate #1, then generate
   * variations by sampling from softmax with different temperatures.
   */
  private generateTopKActions(
    logits: Float32Array,
  ): { actions: number[]; prior: number }[] {
    const candidates: { actions: number[]; prior: number }[] = [];

    // Candidate 1: greedy argmax (temperature → 0)
    const greedyActions = this.decodeLogitsToActions(logits, 0.01);
    candidates.push({ actions: greedyActions.actions, prior: greedyActions.prob });

    // Candidates 2-K: sample at increasing temperatures
    const temperatures = [0.5, 1.0, 1.5, 2.0];
    for (let i = 0; i < temperatures.length && candidates.length < TOP_K_ACTIONS; i++) {
      const sampled = this.decodeLogitsToActions(logits, temperatures[i]);
      // Avoid exact duplicates of greedy
      if (!this.actionsEqual(sampled.actions, greedyActions.actions)) {
        candidates.push({ actions: sampled.actions, prior: sampled.prob });
      }
    }

    // Normalize priors
    const totalPrior = candidates.reduce((s, c) => s + c.prior, 0);
    if (totalPrior > 0) {
      for (const c of candidates) {
        c.prior /= totalPrior;
      }
    }

    return candidates;
  }

  /**
   * Decode policy logits into an action vector.
   * At low temperature → argmax (greedy), at high → more random.
   * Returns both the action array and its approximate probability.
   */
  private decodeLogitsToActions(
    logits: Float32Array,
    temperature: number,
  ): { actions: number[]; prob: number } {
    const actions: number[] = new Array(96);
    let totalLogProb = 0;
    let logitIdx = 0;

    for (let unit = 0; unit < RL_MAX_UNITS; unit++) {
      // Order type (10 options)
      const orderResult = this.sampleFromLogits(logits, logitIdx, RL_ORDER_TYPES, temperature);
      actions[unit * 3] = orderResult.idx;
      totalLogProb += orderResult.logProb;
      logitIdx += RL_ORDER_TYPES;

      // X bin (20 options)
      const xResult = this.sampleFromLogits(logits, logitIdx, RL_TARGET_X_BINS, temperature);
      actions[unit * 3 + 1] = xResult.idx;
      totalLogProb += xResult.logProb;
      logitIdx += RL_TARGET_X_BINS;

      // Y bin (15 options)
      const yResult = this.sampleFromLogits(logits, logitIdx, RL_TARGET_Y_BINS, temperature);
      actions[unit * 3 + 2] = yResult.idx;
      totalLogProb += yResult.logProb;
      logitIdx += RL_TARGET_Y_BINS;
    }

    // Convert log probability to probability (approximate — use exp of mean)
    const meanLogProb = totalLogProb / (RL_MAX_UNITS * 3);
    const prob = Math.exp(meanLogProb);

    return { actions, prob };
  }

  /**
   * Sample from a logit slice with temperature.
   * Returns selected index and its log probability.
   */
  private sampleFromLogits(
    logits: Float32Array,
    offset: number,
    count: number,
    temperature: number,
  ): { idx: number; logProb: number } {
    // Apply temperature
    const scaled: number[] = new Array(count);
    let maxVal = -Infinity;
    for (let i = 0; i < count; i++) {
      scaled[i] = logits[offset + i] / Math.max(0.01, temperature);
      if (scaled[i] > maxVal) maxVal = scaled[i];
    }

    // Softmax
    let sumExp = 0;
    for (let i = 0; i < count; i++) {
      scaled[i] = Math.exp(scaled[i] - maxVal);
      sumExp += scaled[i];
    }

    // If temperature is very low, just argmax
    if (temperature < 0.1) {
      let bestIdx = 0;
      let bestVal = scaled[0];
      for (let i = 1; i < count; i++) {
        if (scaled[i] > bestVal) {
          bestVal = scaled[i];
          bestIdx = i;
        }
      }
      const prob = scaled[bestIdx] / sumExp;
      return { idx: bestIdx, logProb: Math.log(Math.max(1e-10, prob)) };
    }

    // Sample from distribution
    const r = Math.random() * sumExp;
    let cumulative = 0;
    for (let i = 0; i < count; i++) {
      cumulative += scaled[i];
      if (r <= cumulative) {
        const prob = scaled[i] / sumExp;
        return { idx: i, logProb: Math.log(Math.max(1e-10, prob)) };
      }
    }

    // Fallback to last
    const prob = scaled[count - 1] / sumExp;
    return { idx: count - 1, logProb: Math.log(Math.max(1e-10, prob)) };
  }

  /** Check if two action arrays are identical. */
  private actionsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  /**
   * Build observation from snapshot, matching RLController.buildObservation format.
   * Layout: [own_units(32*40), enemy_units(32*40), global(22), tendency(14)] = 2596
   */
  buildObservationFromSnapshot(
    snapshot: LightweightSnapshot,
    team: number,
  ): Float32Array {
    const obs = new Float32Array(RL_OBS_SIZE);

    const ownUnits = snapshot.units
      .filter(u => u.team === team && u.state !== UNIT_STATE_DEAD)
      .sort((a, b) => a.id - b.id);
    const enemyUnits = snapshot.units
      .filter(u => u.team !== team && u.state !== UNIT_STATE_DEAD)
      .sort((a, b) => a.id - b.id);

    // Own units (32 slots x 40 features)
    let offset = 0;
    for (let i = 0; i < RL_MAX_UNITS; i++) {
      if (i < ownUnits.length) {
        this.encodeUnit(obs, offset, ownUnits[i]);
      }
      offset += RL_UNIT_FEATURES;
    }

    // Enemy units (32 slots x 40 features)
    for (let i = 0; i < RL_MAX_UNITS; i++) {
      if (i < enemyUnits.length) {
        this.encodeUnit(obs, offset, enemyUnits[i]);
      }
      offset += RL_UNIT_FEATURES;
    }

    // Global features (22)
    this.encodeGlobal(obs, offset, snapshot, team);
    offset += 22;

    // Tendency features (14) — left as zeros (no tendency data in snapshot)
    // offset += RL_TENDENCY_FEATURES;

    return obs;
  }

  /**
   * Encode a single lightweight unit into 40 features.
   * Matches RLController.encodeUnit format exactly.
   */
  private encodeUnit(obs: Float32Array, offset: number, unit: LightweightUnit): void {
    let i = offset;
    const cfg = unitTypeConfigs[String(unit.type)];
    if (!cfg) return;

    // Continuous features (10)
    obs[i++] = unit.x / MAP_W_PX;
    obs[i++] = unit.y / MAP_H_PX;
    obs[i++] = cfg.maxSize > 0 ? unit.size / cfg.maxSize : 0;
    const maxHp = cfg.maxSize * cfg.hpPerSoldier;
    obs[i++] = maxHp > 0 ? unit.hp / maxHp : 0;
    obs[i++] = unit.morale / 100;
    obs[i++] = unit.fatigue / 100;
    obs[i++] = unit.experience / 100;
    obs[i++] = unit.supply / 100;
    obs[i++] = (unit.facing + Math.PI) / (2 * Math.PI);
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
    obs[i++] = unit.combatTargetId !== -1 ? 1.0 : 0.0;

    // Order type normalized (1)
    const order = unit.orderModifier ?? 0;
    obs[i++] = order / 8.0;

    // Additional features (6)
    obs[i++] = cfg.range / 10.0;
    obs[i++] = cfg.armor / 10.0;
    obs[i++] = cfg.damage / 25.0;
    obs[i++] = unit.combatTicks / 100.0;
    obs[i++] = unit.killCount / 50.0;
    obs[i++] = unit.routTicks / 30.0;
    // Total: 10 + 14 + 6 + 3 + 1 + 6 = 40
  }

  /**
   * Encode 22 global features from snapshot. Matches RLController.encodeGlobal.
   */
  private encodeGlobal(
    obs: Float32Array,
    offset: number,
    snapshot: LightweightSnapshot,
    team: number,
  ): void {
    let i = offset;
    const enemyTeam = 1 - team;

    // General alive (2)
    const ownGeneral = snapshot.units.some(
      u => u.isGeneral && u.team === team && u.state !== UNIT_STATE_DEAD,
    );
    const enemyGeneral = snapshot.units.some(
      u => u.isGeneral && u.team === enemyTeam && u.state !== UNIT_STATE_DEAD,
    );
    obs[i++] = ownGeneral ? 1.0 : 0.0;
    obs[i++] = enemyGeneral ? 1.0 : 0.0;

    // Supply percentages (2)
    const ownSupply = snapshot.supply.find(s => s.team === team);
    const enemySupply = snapshot.supply.find(s => s.team === enemyTeam);
    obs[i++] = (ownSupply?.food ?? 100) / 100;
    obs[i++] = (enemySupply?.food ?? 100) / 100;

    // Weather one-hot (5)
    const weather = snapshot.weather;
    if (weather >= 0 && weather < 5) {
      obs[i + weather] = 1.0;
    }
    i += 5;

    // Time of day one-hot (6)
    const tod = snapshot.timeOfDay;
    if (tod >= 0 && tod < 6) {
      obs[i + tod] = 1.0;
    }
    i += 6;

    // Casualties (2)
    let ownStartTotal = 0, ownCurrentTotal = 0;
    let enemyStartTotal = 0, enemyCurrentTotal = 0;
    for (const u of snapshot.units) {
      const cfg = unitTypeConfigs[String(u.type)];
      if (!cfg) continue;
      if (u.team === team) {
        ownStartTotal += cfg.maxSize;
        ownCurrentTotal += u.state !== UNIT_STATE_DEAD ? u.size : 0;
      } else {
        enemyStartTotal += cfg.maxSize;
        enemyCurrentTotal += u.state !== UNIT_STATE_DEAD ? u.size : 0;
      }
    }
    obs[i++] = ownStartTotal > 0 ? (ownStartTotal - ownCurrentTotal) / ownStartTotal : 0;
    obs[i++] = enemyStartTotal > 0 ? (enemyStartTotal - enemyCurrentTotal) / enemyStartTotal : 0;

    // Squads routed (2)
    const ownRouted = snapshot.units.filter(
      u => u.team === team && u.state === UNIT_STATE_ROUTING,
    ).length;
    const enemyRouted = snapshot.units.filter(
      u => u.team === enemyTeam && u.state === UNIT_STATE_ROUTING,
    ).length;
    const ownTotal = Math.max(1, snapshot.units.filter(u => u.team === team).length);
    const enemyTotal = Math.max(1, snapshot.units.filter(u => u.team === enemyTeam).length);
    obs[i++] = ownRouted / ownTotal;
    obs[i++] = enemyRouted / enemyTotal;

    // Surrender pressure (2)
    const ownPressure = snapshot.surrenderPressure.find(s => s.team === team)?.pressure ?? 0;
    const enemyPressure = snapshot.surrenderPressure.find(s => s.team === enemyTeam)?.pressure ?? 0;
    obs[i++] = ownPressure / 100;
    obs[i++] = enemyPressure / 100;

    // Tick progress (1)
    obs[i++] = snapshot.tick / 6000; // MAX_TICKS = 6000
    // Total: 2+2+5+6+2+2+2+1 = 22
  }
}
