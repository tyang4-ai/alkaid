import { describe, it, expect, beforeEach } from 'vitest';
import { FatigueSystem } from '../FatigueSystem';
import { UnitManager } from '../../units/UnitManager';
import { OrderManager } from '../../OrderManager';
import { UnitType, UnitState, TerrainType } from '../../../constants';
import { TerrainGrid } from '../../terrain/TerrainGrid';

/** Create a terrain grid filled with a single terrain type. */
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

describe('FatigueSystem', () => {
  let fs: FatigueSystem;
  let um: UnitManager;
  let om: OrderManager;

  beforeEach(() => {
    fs = new FatigueSystem(makeGrid());
    um = new UnitManager();
    om = new OrderManager();
  });

  it('marching unit gains fatigue', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.MOVING;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(1); // FATIGUE_MARCH_PER_TICK
  });

  it('fighting unit gains fatigue', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.combatTargetId = 999;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(3); // FATIGUE_FIGHTING_PER_TICK
  });

  it('ford terrain adds extra fatigue when moving', () => {
    fs = new FatigueSystem(makeGrid(TerrainType.FORD));
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.MOVING;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(6); // MARCH(1) + FORD(5)
  });

  it('mountain terrain adds extra fatigue when moving', () => {
    fs = new FatigueSystem(makeGrid(TerrainType.MOUNTAINS));
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.MOVING;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(3); // MARCH(1) + MOUNTAIN(2)
  });

  it('siege engineers get extra fatigue when moving', () => {
    const unit = um.spawn({ type: UnitType.SIEGE_ENGINEERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.MOVING;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(3); // MARCH(1) + SIEGE_CARRY(2)
  });

  it('stationary unit recovers fatigue with well-fed bonus', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.fatigue = 50;
    unit.state = UnitState.IDLE;
    unit.combatTargetId = -1;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(47.5); // RECOVERY(-2) + WELL_FED(-0.5)
  });

  it('well-fed bonus only applies when food > 50%', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.fatigue = 50;
    unit.state = UnitState.IDLE;
    unit.combatTargetId = -1;

    fs.tick(um, om, new Map([[0, 40]])); // below 50%
    expect(unit.fatigue).toBe(48); // RECOVERY(-2) only
  });

  it('fatigue clamped at 0', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.fatigue = 1;
    unit.state = UnitState.IDLE;
    unit.combatTargetId = -1;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(0);
  });

  it('fatigue clamped at 100', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.fatigue = 99;
    unit.combatTargetId = 999; // fighting +3

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(100);
  });

  it('dead units are skipped', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.DEAD;
    unit.fatigue = 50;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(50);
  });

  it('routing units gain march fatigue but not recovery', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.ROUTING;
    unit.fatigue = 10;

    fs.tick(um, om, new Map([[0, 100]]));
    expect(unit.fatigue).toBe(11); // MARCH only
  });

  it('starvation adds extra fatigue', () => {
    const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 32, y: 32 });
    unit.state = UnitState.IDLE;
    unit.combatTargetId = -1;
    unit.fatigue = 50;

    fs.tick(um, om, new Map([[0, 0]])); // starving
    // RECOVERY(-2) + STARVATION(+2) = 0 net
    expect(unit.fatigue).toBe(50);
  });
});

describe('FatigueSystem.getSpeedMultiplier', () => {
  it('returns 1.0 for low fatigue (0-29)', () => {
    expect(FatigueSystem.getSpeedMultiplier(0)).toBe(1.0);
    expect(FatigueSystem.getSpeedMultiplier(29)).toBe(1.0);
  });

  it('returns 0.85 for fatigue 30-59', () => {
    expect(FatigueSystem.getSpeedMultiplier(30)).toBe(0.85);
    expect(FatigueSystem.getSpeedMultiplier(59)).toBe(0.85);
  });

  it('returns 0.70 for fatigue 60-79', () => {
    expect(FatigueSystem.getSpeedMultiplier(60)).toBe(0.70);
    expect(FatigueSystem.getSpeedMultiplier(79)).toBe(0.70);
  });

  it('returns 0.50 for fatigue 80-99', () => {
    expect(FatigueSystem.getSpeedMultiplier(80)).toBe(0.50);
    expect(FatigueSystem.getSpeedMultiplier(99)).toBe(0.50);
  });

  it('returns 0.30 for fatigue 100', () => {
    expect(FatigueSystem.getSpeedMultiplier(100)).toBe(0.30);
  });
});
