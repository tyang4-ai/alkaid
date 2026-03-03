import { describe, it, expect, beforeEach } from 'vitest';
import { RandomEventSystem } from '../RandomEventSystem';
import { UnitType, CampaignPhase } from '../../../constants';
import type { CampaignState, CampaignSquad } from '../CampaignTypes';
import { TerritoryManager } from '../TerritoryManager';
import { createTerritories } from '../TerritoryGraph';

function makeSquad(overrides: Partial<CampaignSquad> = {}): CampaignSquad {
  return {
    squadId: 1,
    type: UnitType.JI_HALBERDIERS,
    size: 100,
    maxSize: 120,
    experience: 30,
    morale: 70,
    fatigue: 0,
    trainingTurnsRemaining: 0,
    isCaptured: false,
    capturedEffectiveness: 1.0,
    ...overrides,
  };
}

function makeState(overrides: Partial<CampaignState> = {}): CampaignState {
  return {
    runId: 'test',
    seed: 42,
    difficulty: 'normal',
    mode: 'ironman',
    territories: [],
    startingTerritoryId: 'longmen',
    roster: {
      squads: [makeSquad()],
      generalAlive: true,
      generalExperience: 0,
      nextSquadId: 2,
    },
    resources: { gold: 500, population: 200, horses: 50, iron: 50, food: 100 },
    turn: 3,
    territoriesConquered: 3,
    battlesWon: 2,
    battlesLost: 0,
    totalEnemiesDefeated: 100,
    totalSoldiersLost: 20,
    bonusObjectivesCompleted: [],
    phase: CampaignPhase.CAMP,
    selectedTerritoryId: null,
    pendingEvent: null,
    ...overrides,
  };
}

describe('RandomEventSystem', () => {
  let res: RandomEventSystem;

  beforeEach(() => {
    res = new RandomEventSystem();
  });

  describe('rollForEvent()', () => {
    it('10% chance produces events in ~10% of rolls', () => {
      let eventCount = 0;
      const state = makeState();
      for (let i = 0; i < 1000; i++) {
        const result = res.rollForEvent(i * 17, 1, state);
        if (result !== null) eventCount++;
      }
      // Should be roughly 10% ± tolerance
      expect(eventCount).toBeGreaterThan(50);
      expect(eventCount).toBeLessThan(200);
    });

    it('deterministic with same seed and turn', () => {
      const state = makeState();
      const r1 = res.rollForEvent(42, 5, state);
      const r2 = res.rollForEvent(42, 5, state);
      expect(r1).toBe(r2);
    });

    it('conditional events check conditions', () => {
      // deserters requires morale < 30
      const state = makeState({
        roster: {
          squads: [makeSquad({ morale: 70 })],
          generalAlive: true,
          generalExperience: 0,
          nextSquadId: 2,
        },
      });
      // Run many seeds; should never get 'deserters' since morale is fine
      let gotDeserters = false;
      for (let i = 0; i < 500; i++) {
        const result = res.rollForEvent(i, 1, state);
        if (result === 'deserters') gotDeserters = true;
      }
      expect(gotDeserters).toBe(false);
    });

    it('deserters can trigger when morale < 30', () => {
      const state = makeState({
        roster: {
          squads: [makeSquad({ morale: 20 })],
          generalAlive: true,
          generalExperience: 0,
          nextSquadId: 2,
        },
      });
      let gotDeserters = false;
      for (let i = 0; i < 2000; i++) {
        const result = res.rollForEvent(i, 1, state);
        if (result === 'deserters') { gotDeserters = true; break; }
      }
      expect(gotDeserters).toBe(true);
    });
  });

  describe('getDefinition()', () => {
    it('returns definition for known event', () => {
      const def = res.getDefinition('peasant_uprising');
      expect(def).toBeDefined();
      expect(def!.chineseName).toBe('民變');
    });

    it('returns undefined for unknown event', () => {
      expect(res.getDefinition('nonexistent')).toBeUndefined();
    });
  });

  describe('applyChoice()', () => {
    it('supply_cache adds 50 food', () => {
      const state = makeState();
      const foodBefore = state.resources.food;
      res.applyChoice('supply_cache', 0, state);
      expect(state.resources.food).toBe(foodBefore + 50);
    });

    it('storm removes 30 food and adds 20 fatigue', () => {
      const state = makeState();
      const foodBefore = state.resources.food;
      res.applyChoice('storm', 0, state);
      expect(state.resources.food).toBe(foodBefore - 30);
      expect(state.roster.squads[0].fatigue).toBe(20);
    });

    it('disease removes 5% soldiers', () => {
      const state = makeState();
      state.roster.squads[0].size = 100;
      res.applyChoice('disease', 0, state);
      expect(state.roster.squads[0].size).toBe(95);
    });

    it('defectors accept adds captured squad and reduces morale', () => {
      const state = makeState();
      const moraleB = state.roster.squads[0].morale;
      const squadCount = state.roster.squads.length;
      res.applyChoice('defectors', 0, state);
      expect(state.roster.squads.length).toBe(squadCount + 1);
      const newSquad = state.roster.squads[state.roster.squads.length - 1];
      expect(newSquad.isCaptured).toBe(true);
      expect(newSquad.size).toBe(30);
      expect(state.roster.squads[0].morale).toBe(moraleB - 10);
    });

    it('defectors refuse has no effect', () => {
      const state = makeState();
      const squadCount = state.roster.squads.length;
      res.applyChoice('defectors', 1, state);
      expect(state.roster.squads.length).toBe(squadCount);
    });

    it('merchant buy costs 200 gold and adds 10 exp', () => {
      const state = makeState();
      const goldBefore = state.resources.gold;
      const expBefore = state.roster.squads[0].experience;
      res.applyChoice('merchant', 0, state);
      expect(state.resources.gold).toBe(goldBefore - 200);
      expect(state.roster.squads[0].experience).toBe(expBefore + 10);
    });

    it('peasant_uprising suppress costs 50 gold', () => {
      const state = makeState();
      const goldBefore = state.resources.gold;
      res.applyChoice('peasant_uprising', 0, state);
      expect(state.resources.gold).toBe(goldBefore - 50);
    });

    it('peasant_uprising abandon loses territory', () => {
      const territories = createTerritories();
      const tm = new TerritoryManager(territories);
      tm.captureTerritory('longmen', 1);
      tm.captureTerritory('cuizhu', 2);
      const state = makeState({ startingTerritoryId: 'longmen', territoriesConquered: 3 });
      res.applyChoice('peasant_uprising', 1, state, tm);
      expect(state.territoriesConquered).toBe(2);
    });

    it('deserters removes lowest morale squad', () => {
      const state = makeState({
        roster: {
          squads: [
            makeSquad({ squadId: 1, morale: 20 }),
            makeSquad({ squadId: 2, morale: 70 }),
          ],
          generalAlive: true,
          generalExperience: 0,
          nextSquadId: 3,
        },
      });
      res.applyChoice('deserters', 0, state);
      expect(state.roster.squads).toHaveLength(1);
      expect(state.roster.squads[0].squadId).toBe(2);
    });

    it('alliance accept captures territory', () => {
      const territories = createTerritories();
      const tm = new TerritoryManager(territories);
      tm.captureTerritory('longmen', 1);
      const state = makeState({ territoriesConquered: 1 });
      const result = res.applyChoice('alliance', 0, state, tm);
      expect(state.territoriesConquered).toBe(2);
      expect(result).toContain('joined');
    });

    it('rival_duel decline costs 5 morale', () => {
      const state = makeState();
      const moraleBefore = state.roster.squads[0].morale;
      res.applyChoice('rival_duel', 1, state);
      expect(state.roster.squads[0].morale).toBe(moraleBefore - 5);
    });
  });
});
