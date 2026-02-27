import type { UnitManager } from '../units/UnitManager';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import type { EnvironmentState } from '../environment/EnvironmentState';
import {
  UnitState, TerrainType,
  TILE_SIZE,
  FATIGUE_MARCH_PER_TICK,
  FATIGUE_FIGHTING_PER_TICK,
  FATIGUE_FORD_PER_TICK,
  FATIGUE_MOUNTAIN_PER_TICK,
  FATIGUE_SIEGE_CARRY_PER_TICK,
  FATIGUE_RECOVERY_STATIONARY,
  FATIGUE_RECOVERY_WELL_FED_BONUS,
  FATIGUE_SPEED_THRESHOLDS,
  SUPPLY_LOW_RATIONS_THRESHOLD,
  SUPPLY_STARVATION_FATIGUE_PER_TICK,
  UnitType,
  WeatherType,
  SNOW_FATIGUE_MULT,
  TIME_OF_DAY_MODIFIERS,
} from '../../constants';

export class FatigueSystem {
  private terrainGrid: TerrainGrid;

  constructor(terrainGrid: TerrainGrid) {
    this.terrainGrid = terrainGrid;
  }

  /** Run fatigue updates for all alive units. Call once per sim tick. */
  tick(
    unitManager: UnitManager,
    _orderManager: unknown,
    armyFoodPercent: Map<number, number>,
    env?: EnvironmentState,
  ): void {
    for (const unit of unitManager.getAll()) {
      if (unit.state === UnitState.DEAD) continue;

      const isMoving = unit.state === UnitState.MOVING;
      const isFighting = unit.combatTargetId !== -1;
      const isRouting = unit.state === UnitState.ROUTING;
      const isStationary = !isMoving && !isFighting && !isRouting;

      // Determine terrain
      const tileX = Math.floor(unit.x / TILE_SIZE);
      const tileY = Math.floor(unit.y / TILE_SIZE);
      const terrain = this.terrainGrid.getTerrain(
        Math.min(Math.max(tileX, 0), this.terrainGrid.width - 1),
        Math.min(Math.max(tileY, 0), this.terrainGrid.height - 1),
      );

      let fatigueGain = 0;

      // Combat fatigue
      if (isFighting) {
        fatigueGain += FATIGUE_FIGHTING_PER_TICK;
      }

      // Marching fatigue
      if (isMoving || isRouting) {
        fatigueGain += FATIGUE_MARCH_PER_TICK;

        // Terrain-specific extra fatigue
        if (terrain === TerrainType.FORD) {
          fatigueGain += FATIGUE_FORD_PER_TICK;
        } else if (terrain === TerrainType.MOUNTAINS) {
          fatigueGain += FATIGUE_MOUNTAIN_PER_TICK;
        }
      }

      // Siege carry fatigue (siege engineers while moving)
      if (unit.type === UnitType.SIEGE_ENGINEERS && isMoving) {
        fatigueGain += FATIGUE_SIEGE_CARRY_PER_TICK;
      }

      // Starvation extra fatigue
      const foodPct = armyFoodPercent.get(unit.team) ?? 100;
      if (foodPct <= 0) {
        fatigueGain += SUPPLY_STARVATION_FATIGUE_PER_TICK;
      }

      // Recovery when stationary and not in combat
      if (isStationary) {
        fatigueGain += FATIGUE_RECOVERY_STATIONARY; // negative = recovery

        // Well-fed bonus recovery (food > 50%)
        if (foodPct > SUPPLY_LOW_RATIONS_THRESHOLD * 100) {
          fatigueGain += FATIGUE_RECOVERY_WELL_FED_BONUS;
        }
      }

      // Weather/time fatigue multiplier (Step 9b)
      if (env) {
        let fatigueMult = 1.0;
        if (env.weather === WeatherType.SNOW) {
          fatigueMult *= SNOW_FATIGUE_MULT;
        }
        const tm = TIME_OF_DAY_MODIFIERS[env.timeOfDay as keyof typeof TIME_OF_DAY_MODIFIERS];
        if (tm && fatigueGain > 0) {
          fatigueMult *= tm.fatigueMult;
        }
        if (fatigueGain > 0) {
          fatigueGain *= fatigueMult;
        }
      }

      unit.fatigue = Math.max(0, Math.min(100, unit.fatigue + fatigueGain));
    }
  }

  /** Lookup speed multiplier from fatigue thresholds. */
  static getSpeedMultiplier(fatigue: number): number {
    for (const [threshold, mult] of FATIGUE_SPEED_THRESHOLDS) {
      if (fatigue >= threshold) return mult;
    }
    return 1.0;
  }
}
