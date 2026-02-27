import type { Unit } from '../units/Unit';
import type { UnitManager } from '../units/UnitManager';
import type { OrderManager } from '../OrderManager';
import { eventBus } from '../../core/EventBus';
import {
  UnitType, UnitState, OrderType,
  COMMAND_RADIUS_FRACTION, DEFAULT_MAP_WIDTH, TILE_SIZE,
  GENERAL_NEARBY_MORALE_PER_TICK,
  ROUT_CASCADE_RADIUS_TILES, ROUT_CASCADE_MORALE_HIT,
  RALLY_MORALE_THRESHOLD_OFFSET,
  ROUT_NO_ORDERS_TICKS,
  MORALE_LOSS_PER_CASUALTY_PERCENT,
} from '../../constants';

const commandRadiusPixels = DEFAULT_MAP_WIDTH * TILE_SIZE * COMMAND_RADIUS_FRACTION;

/** Get rout threshold based on experience and type. */
export function getRoutThreshold(experience: number, type: UnitType): number {
  // Elite Guard always uses elite threshold
  if (type === UnitType.ELITE_GUARD) return 5;
  if (experience >= 80) return 5;   // Elite
  if (experience >= 60) return 10;  // Veteran
  if (experience >= 20) return 15;  // Regular
  return 25;                         // Conscript
}

export class MoraleSystem {
  /** Run morale updates for all units. Call once per sim tick. */
  tick(
    unitManager: UnitManager,
    orderManager: OrderManager,
  ): void {
    const units = unitManager.getAllArray();

    for (const unit of units) {
      if (unit.state === UnitState.DEAD) continue;

      // General nearby bonus: +1.0 morale/tick
      const general = unitManager.getGeneral(unit.team);
      if (general && !unit.isGeneral) {
        const dx = general.x - unit.x;
        const dy = general.y - unit.y;
        if (dx * dx + dy * dy <= commandRadiusPixels * commandRadiusPixels) {
          unit.morale = Math.min(100, unit.morale + GENERAL_NEARBY_MORALE_PER_TICK);
        }
      }

      // Passive recovery when idle and not in combat
      if (unit.state === UnitState.IDLE && unit.combatTargetId === -1) {
        unit.morale = Math.min(100, unit.morale + 0.5);
      }

      // Check for rout
      if (unit.state !== UnitState.ROUTING) {
        const threshold = getRoutThreshold(unit.experience, unit.type);
        if (unit.morale <= threshold) {
          this.routUnit(unit, units, orderManager);
        }
      }

      // Check if routing unit can be rallied
      if (unit.state === UnitState.ROUTING && unit.routTicks === 0) {
        const order = orderManager.getOrder(unit.id);
        if (order?.type === OrderType.RALLY) {
          const threshold = getRoutThreshold(unit.experience, unit.type);
          if (unit.morale > threshold + RALLY_MORALE_THRESHOLD_OFFSET) {
            this.rallyUnit(unit, orderManager);
          }
        }
      }
    }
  }

  /** Apply morale loss from casualties. Called by CombatSystem after damage. */
  applyCasualtyMorale(unit: Unit, percentLost: number): void {
    // -2 morale per 1% strength lost
    unit.morale += MORALE_LOSS_PER_CASUALTY_PERCENT * percentLost;
    unit.morale = Math.max(0, unit.morale);
  }

  private routUnit(
    unit: Unit,
    allUnits: Unit[],
    orderManager: OrderManager,
  ): void {
    unit.state = UnitState.ROUTING;
    unit.routTicks = ROUT_NO_ORDERS_TICKS;
    unit.combatTargetId = -1;
    unit.combatTicks = 0;
    orderManager.clearOrder(unit.id);

    // Set flee direction: toward nearest map edge
    const mapW = DEFAULT_MAP_WIDTH * TILE_SIZE;
    const mapH = DEFAULT_MAP_WIDTH * TILE_SIZE * 0.75; // approximate
    const edgeDist = [
      { angle: Math.PI, dist: unit.x },         // left
      { angle: 0, dist: mapW - unit.x },         // right
      { angle: -Math.PI / 2, dist: unit.y },     // top
      { angle: Math.PI / 2, dist: mapH - unit.y }, // bottom
    ];
    edgeDist.sort((a, b) => a.dist - b.dist);
    unit.facing = edgeDist[0].angle;

    eventBus.emit('unit:routed', { unitId: unit.id, morale: unit.morale });

    // Rout cascade: -10 morale to friendlies within 5 tiles
    const cascadeRadiusPx = ROUT_CASCADE_RADIUS_TILES * TILE_SIZE;
    for (const other of allUnits) {
      if (other.id === unit.id) continue;
      if (other.team !== unit.team) continue;
      if (other.state === UnitState.DEAD || other.state === UnitState.ROUTING) continue;

      const dx = other.x - unit.x;
      const dy = other.y - unit.y;
      if (dx * dx + dy * dy <= cascadeRadiusPx * cascadeRadiusPx) {
        other.morale += ROUT_CASCADE_MORALE_HIT;
        other.morale = Math.max(0, other.morale);
      }
    }
  }

  private rallyUnit(unit: Unit, orderManager: OrderManager): void {
    unit.state = UnitState.IDLE;
    unit.routTicks = 0;
    orderManager.clearOrder(unit.id);
    eventBus.emit('unit:rallied', { unitId: unit.id });
  }
}
