import { describe, it, expect, beforeEach } from 'vitest';
import { TerritoryManager } from '../TerritoryManager';
import { createTerritories, STARTING_TERRITORY_IDS } from '../TerritoryGraph';
import type { Territory } from '../CampaignTypes';

describe('TerritoryManager', () => {
  let tm: TerritoryManager;
  let territories: Territory[];

  beforeEach(() => {
    territories = createTerritories();
    tm = new TerritoryManager(territories);
  });

  describe('territory graph data', () => {
    it('should have exactly 20 territories', () => {
      expect(tm.getAll()).toHaveLength(20);
    });

    it('all territories start as enemy-owned', () => {
      for (const t of tm.getAll()) {
        expect(t.owner).toBe('enemy');
        expect(t.conqueredTurn).toBeNull();
      }
    });

    it('adjacency is bidirectional', () => {
      for (const t of tm.getAll()) {
        for (const adjId of t.adjacentIds) {
          const adj = tm.get(adjId);
          expect(adj, `missing territory ${adjId}`).toBeDefined();
          expect(adj!.adjacentIds).toContain(t.id);
        }
      }
    });

    it('each territory has 2-5 adjacencies', () => {
      for (const t of tm.getAll()) {
        expect(t.adjacentIds.length).toBeGreaterThanOrEqual(2);
        expect(t.adjacentIds.length).toBeLessThanOrEqual(5);
      }
    });

    it('map positions are normalized [0,1]', () => {
      for (const t of tm.getAll()) {
        expect(t.mapPosition.x).toBeGreaterThanOrEqual(0);
        expect(t.mapPosition.x).toBeLessThanOrEqual(1);
        expect(t.mapPosition.y).toBeGreaterThanOrEqual(0);
        expect(t.mapPosition.y).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('get()', () => {
    it('returns territory by id', () => {
      const t = tm.get('longmen');
      expect(t).toBeDefined();
      expect(t!.name).toBe('Longmen');
      expect(t!.chineseName).toBe('龍門');
    });

    it('returns undefined for unknown id', () => {
      expect(tm.get('nonexistent')).toBeUndefined();
    });
  });

  describe('getAdjacentTo()', () => {
    it('returns correct neighbors for longmen', () => {
      const adj = tm.getAdjacentTo('longmen');
      const ids = adj.map(t => t.id).sort();
      expect(ids).toEqual(['cuizhu', 'qingshi']);
    });

    it('returns correct neighbors for zijin (capital, 5 adjacencies)', () => {
      const adj = tm.getAdjacentTo('zijin');
      const ids = adj.map(t => t.id).sort();
      expect(ids).toEqual(['hulao', 'qilin', 'xuanwu', 'yaochi', 'zhuque']);
    });

    it('returns empty for unknown id', () => {
      expect(tm.getAdjacentTo('nonexistent')).toEqual([]);
    });
  });

  describe('getAttackableFrom()', () => {
    it('returns adjacent enemy territories from player territories', () => {
      tm.captureTerritory('longmen', 1);
      const attackable = tm.getAttackableFrom(['longmen']);
      const ids = attackable.map(t => t.id).sort();
      expect(ids).toEqual(['cuizhu', 'qingshi']);
    });

    it('does not include already-owned territories', () => {
      tm.captureTerritory('longmen', 1);
      tm.captureTerritory('cuizhu', 2);
      const attackable = tm.getAttackableFrom(['longmen', 'cuizhu']);
      const ids = attackable.map(t => t.id);
      expect(ids).not.toContain('longmen');
      expect(ids).not.toContain('cuizhu');
    });

    it('deduplicates territories reachable from multiple player territories', () => {
      // longmen and qingshi both have cuizhu? No — check adjacencies
      // longmen -> cuizhu, qingshi. qingshi -> longmen, cangwu, tianzhu, hulao
      tm.captureTerritory('longmen', 1);
      tm.captureTerritory('qingshi', 2);
      const attackable = tm.getAttackableFrom(['longmen', 'qingshi']);
      const ids = attackable.map(t => t.id);
      // No duplicates
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('returns empty when no player territories', () => {
      expect(tm.getAttackableFrom([])).toEqual([]);
    });
  });

  describe('getDistance()', () => {
    it('distance to self is 0', () => {
      expect(tm.getDistance('longmen', 'longmen')).toBe(0);
    });

    it('adjacent territories are distance 1', () => {
      expect(tm.getDistance('longmen', 'cuizhu')).toBe(1);
      expect(tm.getDistance('longmen', 'qingshi')).toBe(1);
    });

    it('capital is reachable from every starting territory', () => {
      for (const startId of STARTING_TERRITORY_IDS) {
        const dist = tm.getDistance(startId, 'zijin');
        expect(dist).toBeGreaterThan(0);
        expect(dist).toBeLessThanOrEqual(6);
      }
    });

    it('all territories are connected (no islands)', () => {
      const all = tm.getAll();
      for (const t of all) {
        expect(tm.getDistance('longmen', t.id)).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns -1 for unknown territory', () => {
      expect(tm.getDistance('longmen', 'nonexistent')).toBe(-1);
      expect(tm.getDistance('nonexistent', 'longmen')).toBe(-1);
    });
  });

  describe('calculateResourceIncome()', () => {
    it('returns zero for no player territories', () => {
      const income = tm.calculateResourceIncome([]);
      expect(income).toEqual({ gold: 0, population: 0, horses: 0, iron: 0, food: 0 });
    });

    it('sums correctly for a single farming plains territory', () => {
      tm.captureTerritory('cangwu', 1); // FARMING_PLAINS
      const income = tm.calculateResourceIncome(['cangwu']);
      expect(income.gold).toBe(80);
      expect(income.population).toBe(60);
      expect(income.food).toBe(30);
    });

    it('sums correctly for multiple territories', () => {
      tm.captureTerritory('cangwu', 1);  // FARMING_PLAINS: gold=80
      tm.captureTerritory('xuanwu', 2);  // TRADE_CITY: gold=150
      const income = tm.calculateResourceIncome(['cangwu', 'xuanwu']);
      expect(income.gold).toBe(230);
    });

    it('ignores non-player territory ids', () => {
      // longmen is still enemy-owned
      const income = tm.calculateResourceIncome(['longmen']);
      expect(income.gold).toBe(0);
    });
  });

  describe('captureTerritory()', () => {
    it('changes owner to player and sets conqueredTurn', () => {
      tm.captureTerritory('longmen', 3);
      const t = tm.get('longmen')!;
      expect(t.owner).toBe('player');
      expect(t.conqueredTurn).toBe(3);
    });
  });

  describe('loseTerritory()', () => {
    it('changes owner back to enemy and clears conqueredTurn', () => {
      tm.captureTerritory('longmen', 3);
      tm.loseTerritory('longmen');
      const t = tm.get('longmen')!;
      expect(t.owner).toBe('enemy');
      expect(t.conqueredTurn).toBeNull();
    });
  });

  describe('getStartingCandidates()', () => {
    it('returns exactly 4 starting territories', () => {
      const candidates = tm.getStartingCandidates();
      expect(candidates).toHaveLength(4);
    });

    it('returns the correct starting territory ids', () => {
      const candidates = tm.getStartingCandidates();
      const ids = candidates.map(t => t.id).sort();
      expect(ids).toEqual([...STARTING_TERRITORY_IDS].sort());
    });

    it('starting territories are on graph edges (low garrison)', () => {
      const candidates = tm.getStartingCandidates();
      for (const c of candidates) {
        expect(c.garrisonStrength).toBeLessThanOrEqual(7);
      }
    });
  });

  describe('getPlayerTerritories()', () => {
    it('returns empty initially', () => {
      expect(tm.getPlayerTerritories()).toEqual([]);
    });

    it('returns captured territories', () => {
      tm.captureTerritory('longmen', 1);
      tm.captureTerritory('baima', 2);
      const player = tm.getPlayerTerritories();
      expect(player).toHaveLength(2);
      expect(player.map(t => t.id).sort()).toEqual(['baima', 'longmen']);
    });
  });
});
