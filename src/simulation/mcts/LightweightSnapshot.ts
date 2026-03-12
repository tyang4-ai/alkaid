/**
 * Lightweight game state snapshot for MCTS rollouts.
 * Minimal data for fast cloning via structuredClone.
 */

import type { Unit } from '../units/Unit';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { SurrenderSystem } from '../combat/SurrenderSystem';

export interface LightweightUnit {
  id: number;
  x: number;
  y: number;
  hp: number;
  morale: number;
  team: number;
  type: number;   // UnitType enum value
  state: number;  // UnitState enum value
  size: number;
  maxSize: number;
  facing: number;
  fatigue: number;
  experience: number;
  supply: number;
  isGeneral: boolean;
  hasCharged: boolean;
  combatTargetId: number;
  orderModifier: number | null;
  combatTicks: number;
  killCount: number;
  routTicks: number;
}

export interface LightweightSnapshot {
  units: LightweightUnit[];
  tick: number;
  weather: number;
  timeOfDay: number;
  supply: { team: number; food: number; maxFood: number }[];
  surrenderPressure: { team: number; pressure: number }[];
}

/** Create a lightweight snapshot from the current game state. */
export function createLightweightSnapshot(
  units: Unit[],
  tick: number,
  weather: number,
  timeOfDay: number,
  supplySystem: SupplySystem,
  surrenderSystem: SurrenderSystem,
): LightweightSnapshot {
  const lightUnits: LightweightUnit[] = [];
  const teamsFound = new Set<number>();

  for (const u of units) {
    teamsFound.add(u.team);
    lightUnits.push({
      id: u.id,
      x: u.x,
      y: u.y,
      hp: u.hp,
      morale: u.morale,
      team: u.team,
      type: u.type,
      state: u.state,
      size: u.size,
      maxSize: u.maxSize,
      facing: u.facing,
      fatigue: u.fatigue ?? 0,
      experience: u.experience ?? 0,
      supply: u.supply ?? 100,
      isGeneral: u.isGeneral,
      hasCharged: u.hasCharged,
      combatTargetId: u.combatTargetId ?? -1,
      orderModifier: u.orderModifier ?? null,
      combatTicks: u.combatTicks ?? 0,
      killCount: u.killCount ?? 0,
      routTicks: u.routTicks ?? 0,
    });
  }

  const supplyData: { team: number; food: number; maxFood: number }[] = [];
  const surrenderData: { team: number; pressure: number }[] = [];

  for (const team of teamsFound) {
    const foodPct = supplySystem.getFoodPercent(team);
    supplyData.push({
      team,
      food: foodPct,
      maxFood: 100, // normalized
    });
    surrenderData.push({
      team,
      pressure: surrenderSystem.getPressure(team),
    });
  }

  return {
    units: lightUnits,
    tick,
    weather,
    timeOfDay,
    supply: supplyData,
    surrenderPressure: surrenderData,
  };
}

/** Fast clone via structuredClone. */
export function cloneSnapshot(snap: LightweightSnapshot): LightweightSnapshot {
  return structuredClone(snap);
}
