import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../../combat/DamageCalculator';
import type { Unit } from '../../units/Unit';
import type { EnvironmentState } from '../EnvironmentState';
import {
  UnitType, UnitState, TerrainType,
  UNIT_TYPE_CONFIGS, WeatherType, TimeOfDay,
} from '../../../constants';

/** Helper to create a test unit. */
function makeUnit(opts: { id?: number; type: UnitType; team: number } & Partial<Unit>): Unit {
  const cfg = UNIT_TYPE_CONFIGS[opts.type];
  const size = opts.size ?? cfg.maxSize;
  return {
    id: opts.id ?? 1,
    type: opts.type,
    team: opts.team,
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    prevX: opts.prevX ?? 100,
    prevY: opts.prevY ?? 100,
    size,
    maxSize: cfg.maxSize,
    hp: size * cfg.hpPerSoldier,
    morale: opts.morale ?? 70,
    fatigue: opts.fatigue ?? 0,
    supply: opts.supply ?? 100,
    experience: opts.experience ?? 50,
    state: opts.state ?? UnitState.IDLE,
    facing: opts.facing ?? 0,
    path: opts.path ?? null,
    pathIndex: opts.pathIndex ?? 0,
    targetX: opts.targetX ?? 100,
    targetY: opts.targetY ?? 100,
    isGeneral: opts.isGeneral ?? false,
    pendingOrderType: opts.pendingOrderType ?? null,
    pendingOrderTick: opts.pendingOrderTick ?? 0,
    attackCooldown: opts.attackCooldown ?? 0,
    lastAttackTick: opts.lastAttackTick ?? 0,
    hasCharged: opts.hasCharged ?? false,
    combatTargetId: opts.combatTargetId ?? -1,
    combatTicks: opts.combatTicks ?? 0,
    siegeSetupTicks: opts.siegeSetupTicks ?? 0,
    formUpTicks: opts.formUpTicks ?? 0,
    disengageTicks: opts.disengageTicks ?? 0,
    orderModifier: opts.orderModifier ?? null,
    routTicks: opts.routTicks ?? 0,
    killCount: opts.killCount ?? 0,
    holdUnderBombardmentTicks: opts.holdUnderBombardmentTicks ?? 0,
    desertionFrac: opts.desertionFrac ?? 0,
  };
}

function makeEnv(overrides?: Partial<EnvironmentState>): EnvironmentState {
  return {
    weather: WeatherType.CLEAR,
    windDirection: 0,
    timeOfDay: TimeOfDay.MORNING,
    currentTick: 0,
    battleStartTime: TimeOfDay.DAWN,
    ...overrides,
  };
}

describe('Environment Integration', () => {
  it('rain reduces crossbow damage', () => {
    const attacker = makeUnit({ id: 1, type: UnitType.NU_CROSSBOWMEN, team: 0 });
    const defender = makeUnit({ id: 2, type: UnitType.JI_HALBERDIERS, team: 1 });

    const noDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0);
    const rainDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ weather: WeatherType.RAIN }));

    expect(rainDmg.finalDamage).toBeLessThan(noDmg.finalDamage);
    // Crossbow in rain: crossbowMult = 0.60
    expect(rainDmg.finalDamage).toBeCloseTo(noDmg.finalDamage * 0.60, 1);
  });

  it('fog reduces ranged accuracy for archers', () => {
    const attacker = makeUnit({ id: 1, type: UnitType.GONG_ARCHERS, team: 0 });
    const defender = makeUnit({ id: 2, type: UnitType.JI_HALBERDIERS, team: 1 });

    const noDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0);
    const fogDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ weather: WeatherType.FOG }));

    expect(fogDmg.finalDamage).toBeLessThan(noDmg.finalDamage);
    // Fog: rangedMult = 0.80
    expect(fogDmg.finalDamage).toBeCloseTo(noDmg.finalDamage * 0.80, 1);
  });

  it('night reduces ranged accuracy', () => {
    const attacker = makeUnit({ id: 1, type: UnitType.GONG_ARCHERS, team: 0 });
    const defender = makeUnit({ id: 2, type: UnitType.JI_HALBERDIERS, team: 1 });

    const dayDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ timeOfDay: TimeOfDay.MORNING }));
    const nightDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ timeOfDay: TimeOfDay.NIGHT }));

    // Night rangedAccuracyMult = 0.80
    expect(nightDmg.finalDamage).toBeLessThan(dayDmg.finalDamage);
    expect(nightDmg.finalDamage).toBeCloseTo(dayDmg.finalDamage * 0.80, 1);
  });

  it('clear weather has no effect on damage', () => {
    const attacker = makeUnit({ id: 1, type: UnitType.GONG_ARCHERS, team: 0 });
    const defender = makeUnit({ id: 2, type: UnitType.JI_HALBERDIERS, team: 1 });

    const noDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0);
    const clearDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ weather: WeatherType.CLEAR, timeOfDay: TimeOfDay.MORNING }));

    // Clear weather + morning: all multipliers are 1.0
    expect(clearDmg.finalDamage).toBeCloseTo(noDmg.finalDamage, 5);
  });

  it('rain reduces siege accuracy', () => {
    const attacker = makeUnit({ id: 1, type: UnitType.SIEGE_ENGINEERS, team: 0 });
    const defender = makeUnit({ id: 2, type: UnitType.JI_HALBERDIERS, team: 1 });

    const noDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0);
    const rainDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ weather: WeatherType.RAIN }));

    // Rain siegeAccuracyMult = 0.70
    expect(rainDmg.finalDamage).toBeLessThan(noDmg.finalDamage);
    expect(rainDmg.finalDamage).toBeCloseTo(noDmg.finalDamage * 0.70, 1);
  });

  it('dusk reduces ranged accuracy (rangedAccuracyMult=0.85)', () => {
    const attacker = makeUnit({ id: 1, type: UnitType.GONG_ARCHERS, team: 0 });
    const defender = makeUnit({ id: 2, type: UnitType.JI_HALBERDIERS, team: 1 });

    const morningDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ timeOfDay: TimeOfDay.MORNING }));
    const duskDmg = calculateDamage(attacker, defender, TerrainType.PLAINS, false, 1.0,
      makeEnv({ timeOfDay: TimeOfDay.DUSK }));

    expect(duskDmg.finalDamage).toBeCloseTo(morningDmg.finalDamage * 0.85, 1);
  });
});
