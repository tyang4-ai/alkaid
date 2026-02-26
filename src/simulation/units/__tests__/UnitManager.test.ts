import { describe, it, expect, beforeEach } from 'vitest';
import { UnitManager } from '../UnitManager';
import {
  UnitType, UnitState, UnitCategory,
  UNIT_TYPE_CONFIGS, TYPE_MATCHUP_TABLE,
} from '../../../constants';

describe('UnitManager', () => {
  let mgr: UnitManager;

  beforeEach(() => {
    mgr = new UnitManager();
  });

  it('spawns a unit with default stats from config', () => {
    const unit = mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 200 });
    expect(unit.id).toBe(1);
    expect(unit.type).toBe(UnitType.JI_HALBERDIERS);
    expect(unit.team).toBe(0);
    expect(unit.x).toBe(100);
    expect(unit.y).toBe(200);
    expect(unit.size).toBe(120); // maxSize from config
    expect(unit.maxSize).toBe(120);
    expect(unit.hp).toBe(120 * 100); // size * hpPerSoldier
    expect(unit.morale).toBe(70);
    expect(unit.fatigue).toBe(0);
    expect(unit.supply).toBe(100);
    expect(unit.experience).toBe(0);
    expect(unit.state).toBe(UnitState.IDLE);
    expect(unit.facing).toBe(0);
  });

  it('assigns incrementing IDs', () => {
    const u1 = mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    const u2 = mgr.spawn({ type: UnitType.DAO_SWORDSMEN, team: 1, x: 0, y: 0 });
    const u3 = mgr.spawn({ type: UnitType.SCOUTS, team: 0, x: 0, y: 0 });
    expect(u1.id).toBe(1);
    expect(u2.id).toBe(2);
    expect(u3.id).toBe(3);
  });

  it('gives Elite Guard default morale of 85', () => {
    const unit = mgr.spawn({ type: UnitType.ELITE_GUARD, team: 0, x: 0, y: 0 });
    expect(unit.morale).toBe(85);
  });

  it('respects custom size', () => {
    const unit = mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0, size: 50 });
    expect(unit.size).toBe(50);
    expect(unit.hp).toBe(50 * 100);
    expect(unit.maxSize).toBe(120); // still max from config
  });

  it('respects custom experience', () => {
    const unit = mgr.spawn({ type: UnitType.DAO_SWORDSMEN, team: 0, x: 0, y: 0, experience: 75 });
    expect(unit.experience).toBe(75);
  });

  it('respects custom morale', () => {
    const unit = mgr.spawn({ type: UnitType.ELITE_GUARD, team: 0, x: 0, y: 0, morale: 50 });
    expect(unit.morale).toBe(50); // overrides elite default
  });

  it('get retrieves a spawned unit', () => {
    const unit = mgr.spawn({ type: UnitType.SCOUTS, team: 1, x: 10, y: 20 });
    expect(mgr.get(unit.id)).toBe(unit);
  });

  it('get returns undefined for missing ID', () => {
    expect(mgr.get(999)).toBeUndefined();
  });

  it('destroy removes unit and returns true', () => {
    const unit = mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    expect(mgr.destroy(unit.id)).toBe(true);
    expect(mgr.get(unit.id)).toBeUndefined();
    expect(mgr.count).toBe(0);
  });

  it('destroy returns false for missing ID', () => {
    expect(mgr.destroy(999)).toBe(false);
  });

  it('getByTeam filters correctly', () => {
    mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    mgr.spawn({ type: UnitType.DAO_SWORDSMEN, team: 1, x: 0, y: 0 });
    mgr.spawn({ type: UnitType.LIGHT_CAVALRY, team: 0, x: 0, y: 0 });

    const team0 = mgr.getByTeam(0);
    const team1 = mgr.getByTeam(1);
    expect(team0).toHaveLength(2);
    expect(team1).toHaveLength(1);
    expect(team0.every(u => u.team === 0)).toBe(true);
    expect(team1[0].team).toBe(1);
  });

  it('tick saves prevX/prevY from current position', () => {
    const unit = mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 200 });
    // Simulate movement
    unit.x = 150;
    unit.y = 250;
    mgr.tick(50);
    expect(unit.prevX).toBe(150);
    expect(unit.prevY).toBe(250);
  });

  it('clear removes all units and resets ID counter', () => {
    mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    mgr.spawn({ type: UnitType.DAO_SWORDSMEN, team: 1, x: 0, y: 0 });
    expect(mgr.count).toBe(2);

    mgr.clear();
    expect(mgr.count).toBe(0);

    // ID counter resets
    const newUnit = mgr.spawn({ type: UnitType.SCOUTS, team: 0, x: 0, y: 0 });
    expect(newUnit.id).toBe(1);
  });

  it('count reflects current number of units', () => {
    expect(mgr.count).toBe(0);
    mgr.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 0, y: 0 });
    expect(mgr.count).toBe(1);
    mgr.spawn({ type: UnitType.DAO_SWORDSMEN, team: 0, x: 0, y: 0 });
    expect(mgr.count).toBe(2);
  });
});

describe('UNIT_TYPE_CONFIGS', () => {
  it('has valid configs for all 13 unit types', () => {
    const allTypes = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as UnitType[];
    for (const t of allTypes) {
      const cfg = UNIT_TYPE_CONFIGS[t];
      expect(cfg).toBeDefined();
      expect(cfg.type).toBe(t);
      expect(cfg.maxSize).toBeGreaterThan(0);
      expect(cfg.hpPerSoldier).toBeGreaterThan(0);
      expect(cfg.cost).toBeGreaterThan(0);
      expect(cfg.displayName).toBeTruthy();
      expect(cfg.chineseName).toBeTruthy();
      expect([
        UnitCategory.INFANTRY, UnitCategory.RANGED,
        UnitCategory.CAVALRY, UnitCategory.SIEGE, UnitCategory.NAVAL,
      ]).toContain(cfg.category);
    }
  });
});

describe('TYPE_MATCHUP_TABLE', () => {
  it('is a 10x10 table of numbers', () => {
    expect(TYPE_MATCHUP_TABLE).toHaveLength(10);
    for (const row of TYPE_MATCHUP_TABLE) {
      expect(row).toHaveLength(10);
      for (const val of row) {
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThan(0);
      }
    }
  });

  it('halberdiers have 1.5x vs all cavalry types', () => {
    expect(TYPE_MATCHUP_TABLE[UnitType.JI_HALBERDIERS][UnitType.LIGHT_CAVALRY]).toBe(1.5);
    expect(TYPE_MATCHUP_TABLE[UnitType.JI_HALBERDIERS][UnitType.HEAVY_CAVALRY]).toBe(1.5);
    expect(TYPE_MATCHUP_TABLE[UnitType.JI_HALBERDIERS][UnitType.HORSE_ARCHERS]).toBe(1.5);
  });
});
