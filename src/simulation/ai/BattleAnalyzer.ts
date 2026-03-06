/**
 * Extracts battle state summary for the Sun Tzu agent chat panel.
 */

import type { UnitManager } from '../units/UnitManager';
import type { SupplySystem } from '../metrics/SupplySystem';
import type { SurrenderSystem } from '../combat/SurrenderSystem';
import type { EnvironmentState } from '../environment/EnvironmentState';
import { UnitState, UNIT_TYPE_CONFIGS } from '../../constants';
import type { UnitType } from '../../constants';

export interface BattleContext {
  terrain: string;
  weather: string;
  timeOfDay: string;
  tick: number;
  own_casualties: number;
  enemy_casualties: number;
  morale: number;
  supply: number;
  own_units: string;
  enemy_units: string;
  pressure_own: number;
  pressure_enemy: number;
}

const WEATHER_NAMES = ['Clear', 'Rain', 'Fog', 'Wind', 'Snow'];
const TIME_NAMES = ['Midnight', 'Dawn', 'Morning', 'Noon', 'Afternoon', 'Dusk'];

const TYPE_NAMES: Record<number, string> = {};
for (const [key, cfg] of Object.entries(UNIT_TYPE_CONFIGS)) {
  TYPE_NAMES[Number(key)] = cfg.displayName ?? `Type ${key}`;
}

export function extractBattleContext(
  unitManager: UnitManager,
  supplySystem: SupplySystem,
  surrenderSystem: SurrenderSystem,
  env: EnvironmentState | null,
  tick: number,
  terrainTemplate: string,
): BattleContext {
  const playerUnits = unitManager.getByTeam(0);
  const enemyUnits = unitManager.getByTeam(1);

  const alive0 = playerUnits.filter(u => u.state !== UnitState.DEAD);
  const alive1 = enemyUnits.filter(u => u.state !== UnitState.DEAD);

  const maxSoldiers0 = playerUnits.reduce((s, u) => s + u.maxSize, 0);
  const curSoldiers0 = alive0.reduce((s, u) => s + u.size, 0);
  const maxSoldiers1 = enemyUnits.reduce((s, u) => s + u.maxSize, 0);
  const curSoldiers1 = alive1.reduce((s, u) => s + u.size, 0);

  const cas0 = maxSoldiers0 > 0 ? Math.round((1 - curSoldiers0 / maxSoldiers0) * 100) : 0;
  const cas1 = maxSoldiers1 > 0 ? Math.round((1 - curSoldiers1 / maxSoldiers1) * 100) : 0;

  const avgMorale = alive0.length > 0
    ? Math.round(alive0.reduce((s, u) => s + u.morale, 0) / alive0.length)
    : 0;

  const countByType = (units: typeof alive0) => {
    const counts: Record<string, number> = {};
    for (const u of units) {
      const name = TYPE_NAMES[u.type as number] ?? `Type ${u.type}`;
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return Object.entries(counts).map(([n, c]) => `${c}x ${n}`).join(', ');
  };

  return {
    terrain: terrainTemplate,
    weather: WEATHER_NAMES[env?.weather ?? 0] ?? 'Unknown',
    timeOfDay: TIME_NAMES[env?.timeOfDay ?? 1] ?? 'Unknown',
    tick,
    own_casualties: cas0,
    enemy_casualties: cas1,
    morale: avgMorale,
    supply: Math.round(supplySystem.getFoodPercent(0)),
    own_units: countByType(alive0),
    enemy_units: countByType(alive1),
    pressure_own: Math.round(surrenderSystem.getPressure(0)),
    pressure_enemy: Math.round(surrenderSystem.getPressure(1)),
  };
}
