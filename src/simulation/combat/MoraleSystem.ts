import type { Unit } from '../units/Unit';
import type { UnitManager } from '../units/UnitManager';
import type { OrderManager } from '../OrderManager';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import type { EnvironmentState } from '../environment/EnvironmentState';
import { eventBus } from '../../core/EventBus';
import {
  UnitType, UnitState, OrderType, TerrainType,
  COMMAND_RADIUS_FRACTION, DEFAULT_MAP_WIDTH, TILE_SIZE,
  GENERAL_NEARBY_MORALE_PER_TICK,
  ROUT_CASCADE_RADIUS_TILES, ROUT_CASCADE_MORALE_HIT,
  RALLY_MORALE_THRESHOLD_OFFSET,
  ROUT_NO_ORDERS_TICKS,
  MORALE_LOSS_PER_CASUALTY_PERCENT,
  SUPPLY_LOW_RATIONS_THRESHOLD,
  SUPPLY_HUNGER_THRESHOLD,
  SUPPLY_WELL_FED_MORALE_PER_TICK,
  SUPPLY_LOW_RATIONS_MORALE_PER_TICK,
  SUPPLY_HUNGER_MORALE_PER_TICK,
  SUPPLY_STARVATION_MORALE_PER_TICK,
  FATIGUE_MORALE_THRESHOLD,
  FATIGUE_MORALE_PENALTY_PER_TICK,
  MORALE_ELITE_GUARD_AURA,
  MORALE_ELITE_GUARD_AURA_RADIUS_TILES,
  MORALE_EXTENDED_COMBAT_PER_TICK,
  MORALE_EXTENDED_COMBAT_THRESHOLD_TICKS,
  MORALE_FAVORABLE_TERRAIN_BONUS,
  MORALE_OUTNUMBERED_PER_TICK,
  MORALE_GENERAL_KILLED_HIT,
  MORALE_WINNING_ENGAGEMENT_BONUS,
  MORALE_WINNING_ENGAGEMENT_RADIUS_TILES,
  MORALE_ARMY_ROUT_30_PERCENT,
  MORALE_ARMY_ROUT_50_PERCENT,
  TERRAIN_STATS,
  TimeOfDay, NIGHT_VETERAN_EXP_THRESHOLD,
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
    armyFoodPercents?: Map<number, number>,
    terrainGrid?: TerrainGrid,
    env?: EnvironmentState,
  ): void {
    const units = unitManager.getAllArray();

    // --- Army rout cascade check (30% / 50% routing) ---
    const teamCounts = new Map<number, { total: number; routing: number }>();
    for (const unit of units) {
      if (unit.state === UnitState.DEAD) continue;
      let entry = teamCounts.get(unit.team);
      if (!entry) { entry = { total: 0, routing: 0 }; teamCounts.set(unit.team, entry); }
      entry.total++;
      if (unit.state === UnitState.ROUTING) entry.routing++;
    }
    for (const [team, counts] of teamCounts) {
      if (counts.total === 0) continue;
      const routPercent = counts.routing / counts.total;
      let moraleHit = 0;
      if (routPercent >= 0.5) {
        moraleHit = MORALE_ARMY_ROUT_50_PERCENT;
      } else if (routPercent >= 0.3) {
        moraleHit = MORALE_ARMY_ROUT_30_PERCENT;
      }
      if (moraleHit < 0) {
        for (const unit of units) {
          if (unit.team !== team || unit.state === UnitState.DEAD || unit.state === UnitState.ROUTING) continue;
          unit.morale = Math.max(0, unit.morale + moraleHit);
        }
        eventBus.emit('morale:armyRoutCascade', { team, routPercent, moraleHit });
      }
    }

    for (const unit of units) {
      if (unit.state === UnitState.DEAD) continue;

      // General nearby bonus
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

      // Elite Guard aura: +3 morale/tick to nearby same-team units
      if (unit.type !== UnitType.ELITE_GUARD) {
        const auraRadiusPx = MORALE_ELITE_GUARD_AURA_RADIUS_TILES * TILE_SIZE;
        const auraRadiusSq = auraRadiusPx * auraRadiusPx;
        for (const other of units) {
          if (other.type !== UnitType.ELITE_GUARD) continue;
          if (other.team !== unit.team) continue;
          if (other.state === UnitState.DEAD) continue;
          const dx = unit.x - other.x;
          const dy = unit.y - other.y;
          if (dx * dx + dy * dy <= auraRadiusSq) {
            unit.morale = Math.min(100, unit.morale + MORALE_ELITE_GUARD_AURA);
            break; // only one aura per tick
          }
        }
      }

      // Supply-based morale
      if (armyFoodPercents) {
        const food = armyFoodPercents.get(unit.team) ?? 100;
        if (food > SUPPLY_LOW_RATIONS_THRESHOLD * 100) {
          unit.morale = Math.min(100, unit.morale + SUPPLY_WELL_FED_MORALE_PER_TICK);
        } else if (food > SUPPLY_HUNGER_THRESHOLD * 100) {
          unit.morale = Math.max(0, unit.morale + SUPPLY_LOW_RATIONS_MORALE_PER_TICK);
        } else if (food > 0) {
          unit.morale = Math.max(0, unit.morale + SUPPLY_HUNGER_MORALE_PER_TICK);
        } else {
          unit.morale = Math.max(0, unit.morale + SUPPLY_STARVATION_MORALE_PER_TICK);
        }
      }

      // Fatigue morale penalty
      if (unit.fatigue >= FATIGUE_MORALE_THRESHOLD) {
        unit.morale = Math.max(0, unit.morale + FATIGUE_MORALE_PENALTY_PER_TICK);
      }

      // Extended combat penalty
      if (unit.combatTargetId !== -1 && unit.combatTicks > MORALE_EXTENDED_COMBAT_THRESHOLD_TICKS) {
        unit.morale = Math.max(0, unit.morale + MORALE_EXTENDED_COMBAT_PER_TICK);
      }

      // Favorable terrain bonus (defending on terrain with defBonus > 0)
      if (terrainGrid && unit.state === UnitState.DEFENDING && unit.combatTargetId !== -1) {
        const tx = Math.floor(unit.x / TILE_SIZE);
        const ty = Math.floor(unit.y / TILE_SIZE);
        const terrain = terrainGrid.getTerrain(tx, ty);
        const stats = TERRAIN_STATS[terrain];
        if (stats && stats.defBonus > 0) {
          unit.morale = Math.min(100, unit.morale + MORALE_FAVORABLE_TERRAIN_BONUS);
        }
      }

      // Outnumbered penalty: count nearby enemy soldiers vs friendly soldiers
      if (unit.combatTargetId !== -1) {
        const checkRadius = 5 * TILE_SIZE;
        const checkRadiusSq = checkRadius * checkRadius;
        let friendlySoldiers = 0;
        let enemySoldiers = 0;
        for (const other of units) {
          if (other.state === UnitState.DEAD) continue;
          const dx = other.x - unit.x;
          const dy = other.y - unit.y;
          if (dx * dx + dy * dy > checkRadiusSq) continue;
          if (other.team === unit.team) {
            friendlySoldiers += other.size;
          } else {
            enemySoldiers += other.size;
          }
        }
        if (friendlySoldiers > 0 && enemySoldiers >= friendlySoldiers * 2) {
          unit.morale = Math.max(0, unit.morale + MORALE_OUTNUMBERED_PER_TICK);
        }
      }

      // Night combat penalty: -3 morale/tick for non-veteran units in combat (Step 9b)
      if (env && env.timeOfDay === TimeOfDay.NIGHT && unit.combatTargetId !== -1) {
        if (unit.experience < NIGHT_VETERAN_EXP_THRESHOLD) {
          unit.morale = Math.max(0, unit.morale - 3);
        }
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
    const mapH = DEFAULT_MAP_WIDTH * TILE_SIZE * 0.75;
    const edgeDist = [
      { angle: Math.PI, dist: unit.x },
      { angle: 0, dist: mapW - unit.x },
      { angle: -Math.PI / 2, dist: unit.y },
      { angle: Math.PI / 2, dist: mapH - unit.y },
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

  /** One-time -30 morale army-wide when general is killed. */
  applyGeneralKilled(team: number, unitManager: UnitManager): void {
    for (const unit of unitManager.getAll()) {
      if (unit.team !== team) continue;
      if (unit.state === UnitState.DEAD) continue;
      unit.morale = Math.max(0, unit.morale + MORALE_GENERAL_KILLED_HIT);
    }
    eventBus.emit('morale:generalKilled', { team });
  }

  /** +5 morale to opposite-team units within 5 tiles of a routed unit. */
  applyWinningEngagement(unitManager: UnitManager, routedUnit: Unit): void {
    const radiusPx = MORALE_WINNING_ENGAGEMENT_RADIUS_TILES * TILE_SIZE;
    const radiusSq = radiusPx * radiusPx;
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;
      if (unit.team === routedUnit.team) continue;
      const dx = unit.x - routedUnit.x;
      const dy = unit.y - routedUnit.y;
      if (dx * dx + dy * dy <= radiusSq) {
        unit.morale = Math.min(100, unit.morale + MORALE_WINNING_ENGAGEMENT_BONUS);
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
