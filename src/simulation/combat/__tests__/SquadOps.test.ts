import { describe, it, expect, beforeEach } from 'vitest';
import { canCombine, combineSquads, splitSquad } from '../SquadOps';
import { UnitManager } from '../../units/UnitManager';
import { UnitType, UnitState, UNIT_TYPE_CONFIGS } from '../../../constants';

describe('SquadOps', () => {
  let um: UnitManager;

  beforeEach(() => {
    um = new UnitManager();
  });

  describe('canCombine', () => {
    it('returns true when both squads are same type, team, and below 70% strength', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 }); // 50%
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 60 }); // 50%
      expect(canCombine(a, b)).toBe(true);
    });

    it('returns false when different types', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 });
      const b = um.spawn({ type: UnitType.DAO_SWORDSMEN, team: 0, x: 150, y: 100, size: 40 });
      expect(canCombine(a, b)).toBe(false);
    });

    it('returns false when different teams', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 });
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 1, x: 150, y: 100, size: 60 });
      expect(canCombine(a, b)).toBe(false);
    });

    it('returns false when either is dead', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 });
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 60 });
      a.state = UnitState.DEAD;
      expect(canCombine(a, b)).toBe(false);
    });

    it('returns false when either is routing', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60 });
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 60 });
      b.state = UnitState.ROUTING;
      expect(canCombine(a, b)).toBe(false);
    });

    it('returns false when above 70% strength', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 100 }); // 83%
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 60 }); // 50%
      expect(canCombine(a, b)).toBe(false);
    });
  });

  describe('combineSquads', () => {
    it('merges sizes capped at maxSize', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 80 });
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 80 });

      combineSquads(a, b);

      expect(a.size).toBe(120); // capped at maxSize
      expect(b.size).toBe(0);
      expect(b.state).toBe(UnitState.DEAD);
    });

    it('weighted-averages morale', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 60, morale: 80 });
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 40, morale: 40 });

      combineSquads(a, b);

      // Weighted: (80*60 + 40*40) / 100 = (4800+1600)/100 = 64
      expect(a.morale).toBeCloseTo(64, 0);
    });

    it('updates HP', () => {
      const a = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 50 });
      const b = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 150, y: 100, size: 50 });

      combineSquads(a, b);

      const cfg = UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS];
      expect(a.hp).toBe(100 * cfg.hpPerSoldier);
    });
  });

  describe('splitSquad', () => {
    it('halves the squad', () => {
      const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 100, morale: 70 });

      const newUnit = splitSquad(unit, um);

      expect(newUnit).not.toBeNull();
      expect(unit.size).toBe(50);
      expect(newUnit!.size).toBe(50);
    });

    it('applies morale penalty to both', () => {
      const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 100, morale: 70 });

      const newUnit = splitSquad(unit, um);

      expect(unit.morale).toBe(60); // -10
      expect(newUnit!.morale).toBe(50); // 60 - 10 (applied during spawn with pre-reduced morale)
    });

    it('returns null for single soldier', () => {
      const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 1 });

      const result = splitSquad(unit, um);
      expect(result).toBeNull();
    });

    it('spawns new unit at offset position', () => {
      const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 80 });

      const newUnit = splitSquad(unit, um);

      expect(newUnit!.x).toBe(116); // 100 + 16
      expect(newUnit!.y).toBe(116);
    });

    it('preserves experience', () => {
      const unit = um.spawn({ type: UnitType.JI_HALBERDIERS, team: 0, x: 100, y: 100, size: 80, experience: 75 });

      const newUnit = splitSquad(unit, um);
      expect(newUnit!.experience).toBe(75);
    });
  });
});
