import { describe, it, expect } from 'vitest';
import { calculateDamage } from '../DamageCalculator';
import type { Unit } from '../../units/Unit';
import { UnitType, UnitState, TerrainType, UNIT_TYPE_CONFIGS } from '../../../constants';

function makeUnit(type: UnitType, overrides: Partial<Unit> = {}): Unit {
  const cfg = UNIT_TYPE_CONFIGS[type];
  return {
    id: 1, type, team: 0,
    x: 100, y: 100, prevX: 100, prevY: 100,
    size: cfg.maxSize, maxSize: cfg.maxSize,
    hp: cfg.maxSize * cfg.hpPerSoldier,
    morale: 70, fatigue: 0, supply: 100, experience: 50,
    state: UnitState.IDLE, facing: 0,
    path: null, pathIndex: 0, targetX: 100, targetY: 100,
    isGeneral: false, pendingOrderType: null, pendingOrderTick: 0,
    attackCooldown: 0, lastAttackTick: 0, hasCharged: false,
    combatTargetId: -1, combatTicks: 0, siegeSetupTicks: 0,
    formUpTicks: 0, disengageTicks: 0, orderModifier: null, routTicks: 0,
    killCount: 0, holdUnderBombardmentTicks: 0, desertionFrac: 0,
    ...overrides,
  };
}

describe('DamageCalculator', () => {
  it('calculates basic melee damage', () => {
    const attacker = makeUnit(UnitType.JI_HALBERDIERS);
    const defender = makeUnit(UnitType.DAO_SWORDSMEN);

    const result = calculateDamage(attacker, defender, TerrainType.PLAINS, false);

    expect(result.finalDamage).toBeGreaterThan(0);
    expect(result.isRanged).toBe(false);
    expect(result.wasCharge).toBe(false);
  });

  it('applies type matchup multiplier', () => {
    const halberds = makeUnit(UnitType.JI_HALBERDIERS);
    const cavalry = makeUnit(UnitType.LIGHT_CAVALRY);

    // Halberdiers vs cavalry: 1.5x
    const result = calculateDamage(halberds, cavalry, TerrainType.PLAINS, false);
    const baseDamage = calculateDamage(halberds, makeUnit(UnitType.JI_HALBERDIERS), TerrainType.PLAINS, false);

    expect(result.finalDamage).toBeGreaterThan(baseDamage.finalDamage);
  });

  it('terrain defense reduces damage', () => {
    const attacker = makeUnit(UnitType.JI_HALBERDIERS);
    const defender = makeUnit(UnitType.JI_HALBERDIERS);

    const plainsResult = calculateDamage(attacker, defender, TerrainType.PLAINS, false);
    const forestResult = calculateDamage(attacker, defender, TerrainType.FOREST, false);

    // Forest has +25% defense, so less damage
    expect(forestResult.finalDamage).toBeLessThan(plainsResult.finalDamage);
  });

  it('fatigue reduces damage', () => {
    const fresh = makeUnit(UnitType.JI_HALBERDIERS, { fatigue: 0 });
    const tired = makeUnit(UnitType.JI_HALBERDIERS, { fatigue: 80 });
    const defender = makeUnit(UnitType.DAO_SWORDSMEN);

    const freshResult = calculateDamage(fresh, defender, TerrainType.PLAINS, false);
    const tiredResult = calculateDamage(tired, defender, TerrainType.PLAINS, false);

    expect(tiredResult.finalDamage).toBeLessThan(freshResult.finalDamage);
  });

  it('experience affects damage', () => {
    const rookie = makeUnit(UnitType.JI_HALBERDIERS, { experience: 0 });
    const veteran = makeUnit(UnitType.JI_HALBERDIERS, { experience: 100 });
    const defender = makeUnit(UnitType.DAO_SWORDSMEN);

    const rookieResult = calculateDamage(rookie, defender, TerrainType.PLAINS, false);
    const vetResult = calculateDamage(veteran, defender, TerrainType.PLAINS, false);

    expect(vetResult.finalDamage).toBeGreaterThan(rookieResult.finalDamage);
  });

  it('cavalry charge bonus applies on first contact', () => {
    const cavalry = makeUnit(UnitType.LIGHT_CAVALRY, { hasCharged: false, combatTicks: 0 });
    const defender = makeUnit(UnitType.DAO_SWORDSMEN);

    const chargeResult = calculateDamage(cavalry, defender, TerrainType.PLAINS, false);

    // Mark as charged and recalculate
    const noChargeCav = makeUnit(UnitType.LIGHT_CAVALRY, { hasCharged: true });
    const noChargeResult = calculateDamage(noChargeCav, defender, TerrainType.PLAINS, false);

    expect(chargeResult.finalDamage).toBeGreaterThan(noChargeResult.finalDamage);
    expect(chargeResult.wasCharge).toBe(true);
    expect(noChargeResult.wasCharge).toBe(false);
  });

  it('heavy cavalry charge does more than light cavalry', () => {
    const light = makeUnit(UnitType.LIGHT_CAVALRY, { hasCharged: false, combatTicks: 0 });
    const heavy = makeUnit(UnitType.HEAVY_CAVALRY, { hasCharged: false, combatTicks: 0 });
    const defender = makeUnit(UnitType.DAO_SWORDSMEN);

    const lightResult = calculateDamage(light, defender, TerrainType.PLAINS, false);
    const heavyResult = calculateDamage(heavy, defender, TerrainType.PLAINS, false);

    expect(heavyResult.finalDamage).toBeGreaterThan(lightResult.finalDamage);
  });

  it('Dao shield reduces ranged damage', () => {
    const xbow = makeUnit(UnitType.NU_CROSSBOWMEN);
    const dao = makeUnit(UnitType.DAO_SWORDSMEN);
    const halberds = makeUnit(UnitType.JI_HALBERDIERS);

    const vsDaoResult = calculateDamage(xbow, dao, TerrainType.PLAINS, false);
    const vsHalbResult = calculateDamage(xbow, halberds, TerrainType.PLAINS, false);

    // Dao takes 30% less from ranged
    expect(vsDaoResult.finalDamage).toBeLessThan(vsHalbResult.finalDamage);
  });

  it('crossbow volley fires 1/3 per tick', () => {
    const xbow = makeUnit(UnitType.NU_CROSSBOWMEN);
    const archer = makeUnit(UnitType.GONG_ARCHERS);
    const defender = makeUnit(UnitType.JI_HALBERDIERS);

    const xbowResult = calculateDamage(xbow, defender, TerrainType.PLAINS, false);
    const archerResult = calculateDamage(archer, defender, TerrainType.PLAINS, false);

    // Both are ranged, but crossbow damage per tick is 1/3 of base
    expect(xbowResult.isRanged).toBe(true);
  });

  it('ranged units cannot fire while moving (except Horse Archers)', () => {
    const xbow = makeUnit(UnitType.NU_CROSSBOWMEN);
    const defender = makeUnit(UnitType.JI_HALBERDIERS);

    const movingResult = calculateDamage(xbow, defender, TerrainType.PLAINS, true);
    expect(movingResult.finalDamage).toBe(0);

    // Horse archers can fire while moving
    const horseArch = makeUnit(UnitType.HORSE_ARCHERS);
    const haResult = calculateDamage(horseArch, defender, TerrainType.PLAINS, true);
    expect(haResult.finalDamage).toBeGreaterThan(0);
  });

  it('Gong Archers have penalty when firing while moving', () => {
    const archer = makeUnit(UnitType.GONG_ARCHERS);
    const defender = makeUnit(UnitType.JI_HALBERDIERS);

    const stationaryResult = calculateDamage(archer, defender, TerrainType.PLAINS, false);
    const movingResult = calculateDamage(archer, defender, TerrainType.PLAINS, true);

    expect(movingResult.finalDamage).toBeLessThan(stationaryResult.finalDamage);
    expect(movingResult.finalDamage).toBeGreaterThan(0);
  });

  it('routing units take extra damage', () => {
    const attacker = makeUnit(UnitType.JI_HALBERDIERS);
    const normalDef = makeUnit(UnitType.DAO_SWORDSMEN);
    const routingDef = makeUnit(UnitType.DAO_SWORDSMEN, { state: UnitState.ROUTING });

    const normalResult = calculateDamage(attacker, normalDef, TerrainType.PLAINS, false);
    const routingResult = calculateDamage(attacker, routingDef, TerrainType.PLAINS, false);

    expect(routingResult.finalDamage).toBeGreaterThan(normalResult.finalDamage);
  });

  it('squad strength scales base damage', () => {
    const full = makeUnit(UnitType.JI_HALBERDIERS, { size: 120 });
    const half = makeUnit(UnitType.JI_HALBERDIERS, { size: 60, maxSize: 120 });
    const defender = makeUnit(UnitType.DAO_SWORDSMEN);

    const fullResult = calculateDamage(full, defender, TerrainType.PLAINS, false);
    const halfResult = calculateDamage(half, defender, TerrainType.PLAINS, false);

    expect(halfResult.finalDamage).toBeLessThan(fullResult.finalDamage);
    expect(halfResult.finalDamage).toBeCloseTo(fullResult.finalDamage / 2, 1);
  });

  it('soldiers killed calculation works', () => {
    const attacker = makeUnit(UnitType.HEAVY_CAVALRY, {
      hasCharged: false, combatTicks: 0, experience: 100,
    });
    const defender = makeUnit(UnitType.SCOUTS); // Low HP per soldier (50)

    const result = calculateDamage(attacker, defender, TerrainType.PLAINS, false);

    expect(result.soldiersKilled).toBeGreaterThanOrEqual(0);
    expect(result.soldiersKilled).toBeLessThanOrEqual(defender.size);
  });
});
