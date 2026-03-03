import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnlockManager } from '../UnlockManager';
import { UnitType, SAVE_UNLOCKS_KEY } from '../../../constants';

// Mock localStorage for tests
const storage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (_i: number) => null as string | null,
};

describe('UnlockManager', () => {
  let um: UnlockManager;

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, writable: true });
    um = new UnlockManager();
    um.reset();
  });

  afterEach(() => {
    storage.clear();
  });

  describe('initial state', () => {
    it('starts with 0 points', () => {
      expect(um.getPointsBalance()).toBe(0);
    });

    it('starts with no unlocks', () => {
      expect(um.getState().unlockedIds).toEqual([]);
    });

    it('base unit types are always available', () => {
      const types = um.getUnlockedUnitTypes();
      expect(types).toContain(UnitType.JI_HALBERDIERS);
      expect(types).toContain(UnitType.DAO_SWORDSMEN);
      expect(types).toContain(UnitType.NU_CROSSBOWMEN);
      expect(types).toContain(UnitType.SCOUTS);
    });
  });

  describe('purchaseUnlock()', () => {
    it('succeeds with sufficient points', () => {
      um.addRunResult({ territoriesConquered: 3, battlesWon: 2, won: false, bonusObjectivesCompleted: 0 });
      // 3*10 + 2*5 = 40 points. Gong Archers costs 20.
      expect(um.purchaseUnlock('gong_archers')).toBe(true);
      expect(um.isUnlocked('gong_archers')).toBe(true);
      expect(um.getPointsBalance()).toBe(20);
    });

    it('fails with insufficient points', () => {
      // 0 points, can't buy anything
      expect(um.purchaseUnlock('gong_archers')).toBe(false);
      expect(um.isUnlocked('gong_archers')).toBe(false);
    });

    it('fails with missing prerequisite', () => {
      um.addRunResult({ territoriesConquered: 10, battlesWon: 10, won: true, bonusObjectivesCompleted: 0 });
      // Heavy cavalry requires light_cavalry
      expect(um.purchaseUnlock('heavy_cavalry')).toBe(false);
    });

    it('succeeds after prerequisite purchased', () => {
      um.addRunResult({ territoriesConquered: 10, battlesWon: 10, won: true, bonusObjectivesCompleted: 0 });
      // 10*10 + 10*5 + 50 = 200 points
      um.purchaseUnlock('light_cavalry'); // 30 pts, balance = 170
      expect(um.purchaseUnlock('heavy_cavalry')).toBe(true); // 50 pts, balance = 120
      expect(um.isUnlocked('heavy_cavalry')).toBe(true);
    });

    it('cannot purchase same unlock twice', () => {
      um.addRunResult({ territoriesConquered: 5, battlesWon: 5, won: false, bonusObjectivesCompleted: 0 });
      um.purchaseUnlock('gong_archers');
      const balanceAfter = um.getPointsBalance();
      expect(um.purchaseUnlock('gong_archers')).toBe(false);
      expect(um.getPointsBalance()).toBe(balanceAfter);
    });

    it('fails for unknown unlock id', () => {
      um.addRunResult({ territoriesConquered: 10, battlesWon: 10, won: true, bonusObjectivesCompleted: 0 });
      expect(um.purchaseUnlock('nonexistent')).toBe(false);
    });
  });

  describe('getAvailableUnlocks()', () => {
    it('returns empty when no points', () => {
      expect(um.getAvailableUnlocks()).toEqual([]);
    });

    it('returns affordable unlocks with prerequisites met', () => {
      um.addRunResult({ territoriesConquered: 3, battlesWon: 2, won: false, bonusObjectivesCompleted: 0 });
      // 40 points — can afford gong_archers (20), light_cavalry (30), naval_meng_chong (35)
      const available = um.getAvailableUnlocks();
      const ids = available.map(u => u.id);
      expect(ids).toContain('gong_archers');
      expect(ids).toContain('light_cavalry');
      expect(ids).toContain('naval_meng_chong');
      // heavy_cavalry requires light_cavalry, so not available
      expect(ids).not.toContain('heavy_cavalry');
    });

    it('excludes already purchased', () => {
      um.addRunResult({ territoriesConquered: 5, battlesWon: 5, won: false, bonusObjectivesCompleted: 0 });
      um.purchaseUnlock('gong_archers');
      const available = um.getAvailableUnlocks();
      expect(available.map(u => u.id)).not.toContain('gong_archers');
    });
  });

  describe('getUnlockedUnitTypes()', () => {
    it('includes unlocked unit types', () => {
      um.addRunResult({ territoriesConquered: 5, battlesWon: 5, won: false, bonusObjectivesCompleted: 0 });
      um.purchaseUnlock('gong_archers');
      const types = um.getUnlockedUnitTypes();
      expect(types).toContain(UnitType.GONG_ARCHERS);
    });

    it('does not include non-unit-type unlocks', () => {
      um.addRunResult({ territoriesConquered: 15, battlesWon: 15, won: true, bonusObjectivesCompleted: 5 });
      um.purchaseUnlock('war_college');
      const types = um.getUnlockedUnitTypes();
      // war_college is a starting_bonus, not a unit_unlock
      expect(types).toHaveLength(4); // just base types
    });
  });

  describe('addRunResult()', () => {
    it('correct point calculation: territories*10 + battles*5 + won?50 + bonus*15', () => {
      const pts = um.addRunResult({
        territoriesConquered: 7,
        battlesWon: 6,
        won: false,
        bonusObjectivesCompleted: 1,
      });
      expect(pts).toBe(7 * 10 + 6 * 5 + 0 + 1 * 15);
      expect(um.getPointsBalance()).toBe(pts);
    });

    it('adds 50 for winning', () => {
      const pts = um.addRunResult({
        territoriesConquered: 15,
        battlesWon: 14,
        won: true,
        bonusObjectivesCompleted: 0,
      });
      expect(pts).toBe(15 * 10 + 14 * 5 + 50 + 0);
    });

    it('accumulates across multiple runs', () => {
      um.addRunResult({ territoriesConquered: 3, battlesWon: 2, won: false, bonusObjectivesCompleted: 0 });
      um.addRunResult({ territoriesConquered: 5, battlesWon: 4, won: false, bonusObjectivesCompleted: 0 });
      expect(um.getPointsBalance()).toBe(40 + 70);
    });
  });

  describe('starting condition helpers', () => {
    it('getStartingExp returns 0 without war_college', () => {
      expect(um.getStartingExp()).toBe(0);
    });

    it('getStartingExp returns 20 with war_college', () => {
      um.addRunResult({ territoriesConquered: 15, battlesWon: 15, won: true, bonusObjectivesCompleted: 5 });
      um.purchaseUnlock('war_college');
      expect(um.getStartingExp()).toBe(20);
    });

    it('getArmySizeMultiplier returns 1.0 without grand_strategist', () => {
      expect(um.getArmySizeMultiplier()).toBe(1.0);
    });

    it('getCommandDelayMultiplier returns 1.0 without swift_messengers', () => {
      expect(um.getCommandDelayMultiplier()).toBe(1.0);
    });

    it('getCommandRadiusMultiplier returns 1.0 without dragon_banner', () => {
      expect(um.getCommandRadiusMultiplier()).toBe(1.0);
    });

    it('getRoutThresholdBonus returns 0 without iron_discipline', () => {
      expect(um.getRoutThresholdBonus()).toBe(0);
    });

    it('getRoutThresholdBonus returns -5 with iron_discipline', () => {
      um.addRunResult({ territoriesConquered: 10, battlesWon: 10, won: true, bonusObjectivesCompleted: 0 });
      um.purchaseUnlock('iron_discipline');
      expect(um.getRoutThresholdBonus()).toBe(-5);
    });
  });

  describe('localStorage persistence', () => {
    it('save and load round-trip', () => {
      um.addRunResult({ territoriesConquered: 5, battlesWon: 3, won: false, bonusObjectivesCompleted: 0 });
      um.purchaseUnlock('gong_archers');
      um.save();

      const um2 = new UnlockManager();
      expect(um2.getPointsBalance()).toBe(um.getPointsBalance());
      expect(um2.isUnlocked('gong_archers')).toBe(true);
    });

    it('handles missing localStorage data', () => {
      storage.clear();
      const um2 = new UnlockManager();
      expect(um2.getPointsBalance()).toBe(0);
    });

    it('handles corrupted localStorage data', () => {
      storage.set(SAVE_UNLOCKS_KEY, 'not-json');
      const um2 = new UnlockManager();
      expect(um2.getPointsBalance()).toBe(0);
    });
  });
});
