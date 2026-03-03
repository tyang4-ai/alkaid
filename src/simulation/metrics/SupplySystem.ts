import type { UnitManager } from '../units/UnitManager';
import type { TerrainGrid } from '../terrain/TerrainGrid';
import type { EnvironmentState } from '../environment/EnvironmentState';
import { eventBus } from '../../core/EventBus';
import type { Serializable } from '../persistence/Serializable';
import type { SupplySnapshot } from '../persistence/SaveTypes';
import {
  UnitState, TILE_SIZE, TERRAIN_STATS,
  SUPPLY_BASE_CAPACITY,
  SUPPLY_CONSUMPTION_PER_SOLDIER_PER_TICK,
  SUPPLY_LOW_RATIONS_THRESHOLD,
  SUPPLY_HUNGER_THRESHOLD,
  SUPPLY_COLLAPSE_TICKS,
  SUPPLY_LOW_RATIONS_SPEED_MULT,
  SUPPLY_HUNGER_SPEED_MULT,
  SUPPLY_HUNGER_COMBAT_MULT,
  SUPPLY_STARVATION_SPEED_MULT,
  SUPPLY_STARVATION_COMBAT_MULT,
  SUPPLY_HUNGER_DESERTION_PER_TICK,
  SUPPLY_STARVATION_DESERTION_PER_TICK,
  UNIT_TYPE_CONFIGS,
  TIME_OF_DAY_MODIFIERS,
} from '../../constants';

interface ArmySupply {
  food: number;
  maxFood: number;
  starvationTicks: number;
}

export class SupplySystem implements Serializable<SupplySnapshot> {
  private armies = new Map<number, ArmySupply>();
  private terrainGrid: TerrainGrid;

  constructor(terrainGrid: TerrainGrid) {
    this.terrainGrid = terrainGrid;
  }

  initArmy(team: number, startingFood?: number, maxFood?: number): void {
    this.armies.set(team, {
      food: startingFood ?? SUPPLY_BASE_CAPACITY,
      maxFood: maxFood ?? SUPPLY_BASE_CAPACITY,
      starvationTicks: 0,
    });
  }

  /** Set food directly (for testing / scripted scenarios). */
  setFood(team: number, food: number): void {
    const army = this.armies.get(team);
    if (army) {
      army.food = Math.max(0, Math.min(army.maxFood, food));
    }
  }

  getFoodPercent(team: number): number {
    const army = this.armies.get(team);
    if (!army || army.maxFood === 0) return 0;
    return (army.food / army.maxFood) * 100;
  }

  getAllFoodPercents(): Map<number, number> {
    const result = new Map<number, number>();
    for (const [team] of this.armies) {
      result.set(team, this.getFoodPercent(team));
    }
    return result;
  }

  tick(unitManager: UnitManager, env?: EnvironmentState): void {
    for (const [team, army] of this.armies) {
      const units = unitManager.getByTeam(team)
        .filter(u => u.state !== UnitState.DEAD);

      if (units.length === 0) continue;

      // 1. Consumption: each soldier costs 0.01 food/tick
      let totalConsumption = 0;
      for (const unit of units) {
        totalConsumption += unit.size * SUPPLY_CONSUMPTION_PER_SOLDIER_PER_TICK;
      }

      // Time-of-day supply consumption modifier (Step 9b)
      if (env) {
        const tm = TIME_OF_DAY_MODIFIERS[env.timeOfDay as keyof typeof TIME_OF_DAY_MODIFIERS];
        if (tm) {
          totalConsumption *= tm.supplyMult;
        }
      }

      // 2. Foraging: each squad forages based on terrain
      let totalForaging = 0;
      for (const unit of units) {
        const tileX = Math.floor(unit.x / TILE_SIZE);
        const tileY = Math.floor(unit.y / TILE_SIZE);
        const terrain = this.terrainGrid.getTerrain(
          Math.min(Math.max(tileX, 0), this.terrainGrid.width - 1),
          Math.min(Math.max(tileY, 0), this.terrainGrid.height - 1),
        );
        totalForaging += TERRAIN_STATS[terrain].forageRate;
      }

      // 3. Update food
      army.food = Math.max(0, Math.min(army.maxFood, army.food - totalConsumption + totalForaging));

      const foodPct = this.getFoodPercent(team);

      // 4. Starvation ticks tracking
      if (foodPct <= 0) {
        army.starvationTicks++;
      } else {
        army.starvationTicks = 0;
      }

      // 5. Desertion
      for (const unit of units) {
        if (unit.state === UnitState.ROUTING) continue;

        let desertionRate = 0;
        if (foodPct <= 0) {
          desertionRate = SUPPLY_STARVATION_DESERTION_PER_TICK;
        } else if (foodPct <= SUPPLY_HUNGER_THRESHOLD * 100) {
          desertionRate = SUPPLY_HUNGER_DESERTION_PER_TICK;
        }

        if (desertionRate > 0) {
          unit.desertionFrac = (unit.desertionFrac ?? 0) + desertionRate;
          while ((unit.desertionFrac ?? 0) >= 1.0 && unit.size > 1) {
            unit.size--;
            unit.hp = unit.size * UNIT_TYPE_CONFIGS[unit.type].hpPerSoldier;
            unit.desertionFrac = (unit.desertionFrac ?? 0) - 1.0;
            eventBus.emit('supply:desertion', {
              unitId: unit.id, team: unit.team, deserted: 1,
            });
          }
        }
      }

      // 6. Collapse event at 50+ starvation ticks
      if (army.starvationTicks >= SUPPLY_COLLAPSE_TICKS) {
        eventBus.emit('supply:collapse', { team });
      }

      // 7. Sync unit.supply for all alive units
      for (const unit of units) {
        unit.supply = foodPct;
      }

      eventBus.emit('supply:updated', {
        team,
        food: army.food,
        maxFood: army.maxFood,
        foodPercent: foodPct,
        starvationTicks: army.starvationTicks,
      });
    }
  }

  serialize(): SupplySnapshot {
    const armies: SupplySnapshot['armies'] = [];
    for (const [team, army] of this.armies) {
      armies.push({ team, food: army.food, maxFood: army.maxFood, starvationTicks: army.starvationTicks });
    }
    return { armies };
  }

  deserialize(data: SupplySnapshot): void {
    this.armies.clear();
    for (const a of data.armies) {
      this.armies.set(a.team, { food: a.food, maxFood: a.maxFood, starvationTicks: a.starvationTicks });
    }
  }

  /** Speed multiplier based on food percentage. */
  static getSpeedMultiplier(foodPercent: number): number {
    if (foodPercent <= 0) return SUPPLY_STARVATION_SPEED_MULT;
    if (foodPercent <= SUPPLY_HUNGER_THRESHOLD * 100) return SUPPLY_HUNGER_SPEED_MULT;
    if (foodPercent <= SUPPLY_LOW_RATIONS_THRESHOLD * 100) return SUPPLY_LOW_RATIONS_SPEED_MULT;
    return 1.0;
  }

  /** Combat multiplier based on food percentage. */
  static getCombatMultiplier(foodPercent: number): number {
    if (foodPercent <= 0) return SUPPLY_STARVATION_COMBAT_MULT;
    if (foodPercent <= SUPPLY_HUNGER_THRESHOLD * 100) return SUPPLY_HUNGER_COMBAT_MULT;
    return 1.0;
  }
}
