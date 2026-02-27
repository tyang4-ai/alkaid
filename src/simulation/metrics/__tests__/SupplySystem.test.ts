import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupplySystem } from '../SupplySystem';
import { UnitManager } from '../../units/UnitManager';
import { UnitType, UnitState, TerrainType, SUPPLY_BASE_CAPACITY } from '../../../constants';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { eventBus } from '../../../core/EventBus';

function makeGrid(terrain: TerrainType = TerrainType.PLAINS, w = 10, h = 10): TerrainGrid {
  const size = w * h;
  return new TerrainGrid({
    width: w, height: h, seed: 1, templateId: 'test',
    elevation: new Float32Array(size).fill(0.5),
    moisture: new Float32Array(size).fill(0.5),
    terrain: new Uint8Array(size).fill(terrain),
    riverFlow: new Int8Array(size).fill(-1),
    tileBitmask: new Uint8Array(size).fill(0),
  });
}

describe('SupplySystem', () => {
  let ss: SupplySystem;
  let um: UnitManager;

  beforeEach(() => {
    eventBus.clear();
    ss = new SupplySystem(makeGrid());
    um = new UnitManager();
  });

  it('initArmy sets up food pool', () => {
    ss.initArmy(0, 100, 100);
    expect(ss.getFoodPercent(0)).toBe(100);
  });

  it('getFoodPercent returns correct percentage', () => {
    ss.initArmy(0, 50, 100);
    expect(ss.getFoodPercent(0)).toBe(50);
  });

  it('getAllFoodPercents returns map for all teams', () => {
    ss.initArmy(0, 100, 100);
    ss.initArmy(1, 50, 100);
    const pcts = ss.getAllFoodPercents();
    expect(pcts.get(0)).toBe(100);
    expect(pcts.get(1)).toBe(50);
  });

  it('consumption reduces food per soldier per tick', () => {
    ss.initArmy(0, 100, 100);
    // 120 soldiers * 0.01 = 1.2 consumption per tick
    // Plains forageRate = 1.0 per squad = 1.0
    // Net: 100 - 1.2 + 1.0 = 99.8
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });

    ss.tick(um);
    expect(ss.getFoodPercent(0)).toBeCloseTo(99.8, 1);
  });

  it('food floor at 0', () => {
    ss.initArmy(0, 0.1, 100);
    // Large army with high consumption
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32, size: 120 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 64, y: 32, size: 120 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 96, y: 32, size: 120 });

    ss.tick(um);
    expect(ss.getFoodPercent(0)).toBe(0);
  });

  it('foraging adds food based on terrain', () => {
    // Forest has forageRate 1.5
    const forestGrid = makeGrid(TerrainType.FOREST);
    ss = new SupplySystem(forestGrid);
    ss.initArmy(0, 50, 100);
    // 1 squad of 120: consumption = 1.2, foraging = 1.5
    // Net: +0.3
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });

    ss.tick(um);
    expect(ss.getFoodPercent(0)).toBeCloseTo(50.3, 1);
  });

  it('starvationTicks count consecutive ticks at 0% food', () => {
    ss.initArmy(0, 0, 100);
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });

    ss.tick(um);
    ss.tick(um);
    ss.tick(um);

    // Food stays at 0 because foraging (1.0) < consumption (1.2)
    // Each tick starvationTicks increments
    // After 3 ticks, starvationTicks = 3
    const updated = vi.fn();
    eventBus.on('supply:updated', updated);
    ss.tick(um);
    expect(updated).toHaveBeenCalled();
    expect(updated.mock.calls[0][0].starvationTicks).toBeGreaterThanOrEqual(1);
  });

  it('starvationTicks resets when food > 0', () => {
    ss.initArmy(0, 0, 100);
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    ss.tick(um); // starvation tick 1

    // Give food back
    ss.initArmy(0, 50, 100);
    const updated = vi.fn();
    eventBus.on('supply:updated', updated);
    ss.tick(um);
    expect(updated.mock.calls[0][0].starvationTicks).toBe(0);
  });

  it('desertion accumulates and removes soldiers at hunger level', () => {
    ss.initArmy(0, 10, 100); // 10% food < 25% hunger threshold
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    const startSize = unit.size;

    // Run many ticks to accumulate desertion
    // desertionRate = 0.5/tick at hunger, so after 2 ticks = 1.0 -> 1 soldier deserts
    ss.tick(um);
    ss.tick(um);

    expect(unit.size).toBeLessThan(startSize);
  });

  it('starvation desertion is faster than hunger', () => {
    // Starvation: 1.5/tick vs hunger: 0.5/tick
    ss.initArmy(0, 0, 100); // 0% = starvation
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    const startSize = unit.size;

    ss.tick(um); // 1.5 frac -> 1 deserts, 0.5 remainder
    expect(unit.size).toBeLessThan(startSize);
    expect(unit.size).toBe(startSize - 1);
  });

  it('collapse event emitted at 50+ starvation ticks', () => {
    // Use road terrain (forageRate=0) to prevent food recovery
    const roadGrid = makeGrid(TerrainType.ROAD);
    ss = new SupplySystem(roadGrid);
    ss.initArmy(0, 0, 100);
    // General has size=1, so consumption=0.01, minimal desertion impact
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 32, y: 32, isGeneral: true });

    const collapse = vi.fn();
    eventBus.on('supply:collapse', collapse);

    for (let i = 0; i < 50; i++) {
      ss.tick(um);
    }
    expect(collapse).toHaveBeenCalledWith({ team: 0 });
  });

  it('food capped at maxFood', () => {
    // Use forest grid (forageRate 1.5) with small army
    const forestGrid = makeGrid(TerrainType.FOREST);
    ss = new SupplySystem(forestGrid);
    ss.initArmy(0, 99.9, 100);
    // Small unit: consumption = 1*0.01 = 0.01, foraging = 1.5
    um.spawn({ type: UnitType.GENERAL, team: 0, x: 32, y: 32 });

    ss.tick(um);
    expect(ss.getFoodPercent(0)).toBe(100); // capped
  });

  it('syncs unit.supply to team food percent', () => {
    ss.initArmy(0, 60, 100);
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });

    ss.tick(um);
    // After tick, unit.supply should reflect team food %
    expect(unit.supply).toBeCloseTo(ss.getFoodPercent(0), 0);
  });

  it('dead units are not counted for consumption', () => {
    ss.initArmy(0, 50, 100);
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.DEAD;

    const before = ss.getFoodPercent(0);
    ss.tick(um);
    // No alive units, no consumption, no foraging
    expect(ss.getFoodPercent(0)).toBe(before);
  });
});

describe('SupplySystem static multipliers', () => {
  it('getSpeedMultiplier returns correct values', () => {
    expect(SupplySystem.getSpeedMultiplier(100)).toBe(1.0);    // well-fed
    expect(SupplySystem.getSpeedMultiplier(51)).toBe(1.0);     // above 50%
    expect(SupplySystem.getSpeedMultiplier(50)).toBe(0.90);    // low rations
    expect(SupplySystem.getSpeedMultiplier(25)).toBe(0.80);    // hunger
    expect(SupplySystem.getSpeedMultiplier(10)).toBe(0.80);    // still hunger
    expect(SupplySystem.getSpeedMultiplier(0)).toBe(0.70);     // starvation
  });

  it('getCombatMultiplier returns correct values', () => {
    expect(SupplySystem.getCombatMultiplier(100)).toBe(1.0);
    expect(SupplySystem.getCombatMultiplier(51)).toBe(1.0);
    expect(SupplySystem.getCombatMultiplier(50)).toBe(1.0);    // low rations no combat penalty
    expect(SupplySystem.getCombatMultiplier(25)).toBe(0.80);   // hunger
    expect(SupplySystem.getCombatMultiplier(0)).toBe(0.60);    // starvation
  });
});
