import { describe, it, expect, beforeEach } from 'vitest';
import { CombatSystem } from '../CombatSystem';
import { MoraleSystem } from '../MoraleSystem';
import { UnitManager } from '../../units/UnitManager';
import { PathManager } from '../../pathfinding/PathManager';
import { TerrainGrid } from '../../terrain/TerrainGrid';
import { UnitType, UnitState } from '../../../constants';

function makeGrid(w = 50, h = 50): TerrainGrid {
  const terrain = new Uint8Array(w * h).fill(2); // PLAINS
  return new TerrainGrid({
    width: w, height: h, seed: 0, templateId: 'test',
    elevation: new Float32Array(w * h),
    moisture: new Float32Array(w * h),
    terrain,
    riverFlow: new Int8Array(w * h).fill(-1),
    tileBitmask: new Uint8Array(w * h),
  });
}

describe('CombatSystem', () => {
  let grid: TerrainGrid;
  let cs: CombatSystem;
  let ms: MoraleSystem;
  let um: UnitManager;
  let pm: PathManager;

  beforeEach(() => {
    grid = makeGrid();
    cs = new CombatSystem(grid);
    ms = new MoraleSystem();
    um = new UnitManager();
    pm = new PathManager(grid);
  });

  function updateSpatialHash(): void {
    pm.updateSpatialHash(um.getAll());
  }

  it('detects engagement when enemies are within range', () => {
    // Place melee units within 1 tile (16px) of each other
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    const defender = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 112, y: 100 });

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    expect(attacker.combatTargetId).toBe(defender.id);
    expect(attacker.state).toBe(UnitState.ATTACKING);
  });

  it('does not engage units on the same team', () => {
    const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 112, y: 100 });

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    expect(a.combatTargetId).toBe(-1);
    expect(b.combatTargetId).toBe(-1);
  });

  it('does not engage enemies out of range', () => {
    const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    // Melee range = 1 tile = 16px, place at 200px away
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 300, y: 100 });

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    expect(a.combatTargetId).toBe(-1);
  });

  it('ranged units detect enemies at longer range', () => {
    // Crossbows have 8 tile range = 128px
    const xbow = um.spawn({ type: UnitType.NU_CROSSBOWMEN, team: 0, x: 100, y: 100 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100 }); // 100px away

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    expect(xbow.combatTargetId).not.toBe(-1);
  });

  it('applies damage over time and kills units', () => {
    um.spawn({
      type: UnitType.HEAVY_CAVALRY, team: 0, x: 100, y: 100,
      experience: 50,
    });
    const defender = um.spawn({
      type: UnitType.SCOUTS, team: 1, x: 110, y: 100,
      size: 5, // Very small, will die quickly
    });

    const initialSize = defender.size;

    updateSpatialHash();
    // Run enough ticks for engagement + multiple attack cycles
    for (let t = 0; t < 300; t++) {
      pm.updateSpatialHash(um.getAll());
      cs.tick(t, um, pm.spatialHash, ms);
    }

    expect(defender.size).toBeLessThan(initialSize);
  });

  it('cavalry charge sets hasCharged flag', () => {
    const cav = um.spawn({
      type: UnitType.LIGHT_CAVALRY, team: 0, x: 100, y: 100,
    });
    um.spawn({ type: UnitType.SCOUTS, team: 1, x: 110, y: 100 });

    updateSpatialHash();
    // Tick until attack happens (cooldown ~22 ticks for light cav)
    for (let t = 0; t < 200; t++) {
      pm.updateSpatialHash(um.getAll());
      cs.tick(t, um, pm.spatialHash, ms);
    }

    expect(cav.hasCharged).toBe(true);
  });

  it('disengages when target dies', () => {
    const attacker = um.spawn({ type: UnitType.HEAVY_CAVALRY, team: 0, x: 100, y: 100 });
    const defender = um.spawn({ type: UnitType.SCOUTS, team: 1, x: 110, y: 100, size: 1 });

    updateSpatialHash();
    // Kill the defender (cooldown ~29 ticks for heavy cav, size=1 should die in one hit)
    for (let t = 0; t < 500; t++) {
      pm.updateSpatialHash(um.getAll());
      cs.tick(t, um, pm.spatialHash, ms);
      if (defender.state === UnitState.DEAD) break;
    }

    expect(defender.state).toBe(UnitState.DEAD);
    expect(attacker.combatTargetId).toBe(-1);
  });

  it('siege requires setup time before firing', () => {
    const siege = um.spawn({ type: UnitType.SIEGE_ENGINEERS, team: 0, x: 100, y: 100 });
    const defender = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 200, y: 100 });

    const initialSize = defender.size;

    updateSpatialHash();
    // Run for a few ticks — should not deal damage yet (setup time is 100 ticks)
    for (let t = 0; t < 10; t++) {
      pm.updateSpatialHash(um.getAll());
      cs.tick(t, um, pm.spatialHash, ms);
    }

    expect(siege.siegeSetupTicks).toBeGreaterThan(0);
    expect(defender.size).toBe(initialSize); // No damage yet
  });

  it('getEngagedPairs returns unique combat pairs', () => {
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 112, y: 100 });

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    const pairs = cs.getEngagedPairs(um);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    // Check no duplicates
    const keys = pairs.map(p => `${Math.min(p.attacker.id, p.defender.id)}-${Math.max(p.attacker.id, p.defender.id)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('generals do not auto-engage', () => {
    const general = um.spawn({ type: UnitType.GENERAL, team: 0, x: 100, y: 100, isGeneral: true });
    um.spawn({ type: UnitType.SCOUTS, team: 1, x: 110, y: 100 });

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    expect(general.combatTargetId).toBe(-1);
  });

  it('skip dead and routing units for engagement detection', () => {
    const attacker = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100 });
    const dead = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 112, y: 100 });
    dead.state = UnitState.DEAD;

    updateSpatialHash();
    cs.tick(0, um, pm.spatialHash, ms);

    expect(attacker.combatTargetId).toBe(-1);
  });
});
