import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignManager } from '../CampaignManager';
import { EventBus } from '../../../core/EventBus';
import { CampaignPhase, UnitType, CAMPAIGN_WIN_TERRITORIES } from '../../../constants';
import type { BattleResult } from '../CampaignTypes';

function makeBattleResult(overrides: Partial<BattleResult> = {}): BattleResult {
  return {
    won: true,
    victoryType: 1,
    generalAlive: true,
    survivingPlayerSquads: [],
    capturedEnemySquads: [],
    totalEnemiesDefeated: 50,
    totalPlayerLosses: 10,
    battleDurationTicks: 200,
    noSquadFullyLost: false,
    ...overrides,
  };
}

describe('CampaignManager', () => {
  let cm: CampaignManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    cm = new CampaignManager(eventBus);
    cm.startNewRun(42, 'longmen');
  });

  describe('startNewRun()', () => {
    it('initializes valid campaign state', () => {
      const state = cm.getState();
      expect(state.seed).toBe(42);
      expect(state.startingTerritoryId).toBe('longmen');
      expect(state.turn).toBe(1);
      expect(state.phase).toBe(CampaignPhase.CAMPAIGN_MAP);
      expect(state.territoriesConquered).toBe(1);
      expect(state.roster.generalAlive).toBe(true);
    });

    it('starting territory is player-owned', () => {
      const tm = cm.getTerritoryManager();
      const longmen = tm.get('longmen')!;
      expect(longmen.owner).toBe('player');
    });

    it('starting army has correct composition', () => {
      const squads = cm.getState().roster.squads;
      const types = squads.map(s => s.type);

      const halberdCount = types.filter(t => t === UnitType.JI_HALBERDIERS).length;
      const crossbowCount = types.filter(t => t === UnitType.NU_CROSSBOWMEN).length;
      const swordCount = types.filter(t => t === UnitType.DAO_SWORDSMEN).length;
      const scoutCount = types.filter(t => t === UnitType.SCOUTS).length;

      expect(halberdCount).toBe(3);
      expect(crossbowCount).toBe(2);
      expect(swordCount).toBe(1);
      expect(scoutCount).toBe(1);
      expect(squads).toHaveLength(7);
    });

    it('includes elite guard when unlocked', () => {
      const cm2 = new CampaignManager(eventBus);
      cm2.startNewRun(42, 'longmen', [UnitType.ELITE_GUARD]);
      const squads = cm2.getState().roster.squads;
      const eliteGuard = squads.find(s => s.type === UnitType.ELITE_GUARD);
      expect(eliteGuard).toBeDefined();
      expect(eliteGuard!.size).toBe(15);
      expect(squads).toHaveLength(8);
    });

    it('applies starting experience', () => {
      const cm2 = new CampaignManager(eventBus);
      cm2.startNewRun(42, 'longmen', [], 20);
      const squads = cm2.getState().roster.squads;
      for (const s of squads) {
        expect(s.experience).toBeGreaterThanOrEqual(20);
      }
    });

    it('starting resources are correct', () => {
      const r = cm.getState().resources;
      expect(r.gold).toBe(300);
      expect(r.food).toBe(100);
    });

    it('emits campaign:runStarted', () => {
      const handler = vi.fn();
      eventBus.on('campaign:runStarted', handler);
      const cm2 = new CampaignManager(eventBus);
      cm2.startNewRun(99, 'baima');
      expect(handler).toHaveBeenCalledWith({ seed: 99, startTerritoryId: 'baima' });
    });
  });

  describe('transitionTo()', () => {
    it('allows legal transitions', () => {
      // CAMPAIGN_MAP -> CAMP
      expect(cm.transitionTo(CampaignPhase.CAMP)).toBe(true);
      expect(cm.getState().phase).toBe(CampaignPhase.CAMP);

      // CAMP -> CAMPAIGN_MAP
      expect(cm.transitionTo(CampaignPhase.CAMPAIGN_MAP)).toBe(true);
      expect(cm.getState().phase).toBe(CampaignPhase.CAMPAIGN_MAP);
    });

    it('rejects illegal transitions', () => {
      // CAMPAIGN_MAP -> BATTLE (must go through PRE_BATTLE_INTEL)
      expect(cm.transitionTo(CampaignPhase.BATTLE)).toBe(false);
      expect(cm.getState().phase).toBe(CampaignPhase.CAMPAIGN_MAP);
    });

    it('emits campaign:phaseChanged on success', () => {
      const handler = vi.fn();
      eventBus.on('campaign:phaseChanged', handler);
      cm.transitionTo(CampaignPhase.CAMP);
      expect(handler).toHaveBeenCalledWith({
        oldPhase: CampaignPhase.CAMPAIGN_MAP,
        newPhase: CampaignPhase.CAMP,
      });
    });

    it('RUN_OVER has no allowed transitions', () => {
      // Force to RUN_OVER via transitions
      cm.transitionTo(CampaignPhase.PRE_BATTLE_INTEL);
      cm.transitionTo(CampaignPhase.BATTLE);
      cm.transitionTo(CampaignPhase.POST_BATTLE);
      cm.transitionTo(CampaignPhase.RUN_OVER);
      expect(cm.transitionTo(CampaignPhase.CAMPAIGN_MAP)).toBe(false);
    });
  });

  describe('advanceTurn()', () => {
    it('collects resources from owned territories', () => {
      const goldBefore = cm.getState().resources.gold;
      cm.advanceTurn();
      // Longmen is FRONTIER_FORT: gold=30
      expect(cm.getState().resources.gold).toBe(goldBefore + 30);
    });

    it('decrements training turns', () => {
      // Add a squad in training
      cm.getState().roster.squads.push({
        squadId: 100,
        type: UnitType.GONG_ARCHERS,
        size: 80,
        maxSize: 80,
        experience: 0,
        morale: 70,
        fatigue: 0,
        trainingTurnsRemaining: 2,
        isCaptured: false,
        capturedEffectiveness: 1.0,
      });

      cm.advanceTurn();
      const squad = cm.getState().roster.squads.find(s => s.squadId === 100)!;
      expect(squad.trainingTurnsRemaining).toBe(1);
    });

    it('improves captured troop effectiveness', () => {
      cm.getState().roster.squads.push({
        squadId: 101,
        type: UnitType.JI_HALBERDIERS,
        size: 50,
        maxSize: 120,
        experience: 10,
        morale: 60,
        fatigue: 0,
        trainingTurnsRemaining: 0,
        isCaptured: true,
        capturedEffectiveness: 0.5,
      });

      cm.advanceTurn();
      const squad = cm.getState().roster.squads.find(s => s.squadId === 101)!;
      expect(squad.capturedEffectiveness).toBeCloseTo(0.6);
    });

    it('caps captured effectiveness at 1.0', () => {
      cm.getState().roster.squads.push({
        squadId: 102,
        type: UnitType.JI_HALBERDIERS,
        size: 50,
        maxSize: 120,
        experience: 10,
        morale: 60,
        fatigue: 0,
        trainingTurnsRemaining: 0,
        isCaptured: true,
        capturedEffectiveness: 0.95,
      });

      cm.advanceTurn();
      const squad = cm.getState().roster.squads.find(s => s.squadId === 102)!;
      expect(squad.capturedEffectiveness).toBe(1.0);
    });

    it('increments turn counter and emits', () => {
      const handler = vi.fn();
      eventBus.on('campaign:turnAdvanced', handler);
      cm.advanceTurn();
      expect(cm.getState().turn).toBe(2);
      expect(handler).toHaveBeenCalledWith({ turn: 2 });
    });
  });

  describe('selectTerritory()', () => {
    it('succeeds for adjacent enemy territory', () => {
      // Longmen is player-owned. Its neighbors: cuizhu, qingshi (both enemy)
      expect(cm.selectTerritory('cuizhu')).toBe(true);
      expect(cm.getState().selectedTerritoryId).toBe('cuizhu');
    });

    it('fails for non-adjacent territory', () => {
      expect(cm.selectTerritory('zijin')).toBe(false);
      expect(cm.getState().selectedTerritoryId).toBeNull();
    });

    it('fails for own territory', () => {
      expect(cm.selectTerritory('longmen')).toBe(false);
    });

    it('fails for unknown territory', () => {
      expect(cm.selectTerritory('nonexistent')).toBe(false);
    });
  });

  describe('getPlayerRosterForDeployment()', () => {
    it('only includes squads with training=0', () => {
      cm.getState().roster.squads.push({
        squadId: 200,
        type: UnitType.GONG_ARCHERS,
        size: 80,
        maxSize: 80,
        experience: 0,
        morale: 70,
        fatigue: 0,
        trainingTurnsRemaining: 2,
        isCaptured: false,
        capturedEffectiveness: 1.0,
      });

      const ready = cm.getPlayerRosterForDeployment();
      expect(ready.every(s => s.trainingTurnsRemaining === 0)).toBe(true);
      expect(ready.find(s => s.squadId === 200)).toBeUndefined();
    });
  });

  describe('processBattleResult()', () => {
    it('updates roster based on survivors', () => {
      const squads = cm.getState().roster.squads;
      const firstSquadId = squads[0].squadId;

      const result = makeBattleResult({
        won: true,
        survivingPlayerSquads: [
          { squadId: firstSquadId, type: UnitType.JI_HALBERDIERS, size: 80, experience: 15 },
        ],
      });

      cm.selectTerritory('cuizhu');
      cm.processBattleResult(result);

      // Only 1 deployed survivor + any training squads
      const remaining = cm.getState().roster.squads;
      const survivor = remaining.find(s => s.squadId === firstSquadId);
      expect(survivor).toBeDefined();
      expect(survivor!.size).toBe(80);
      expect(survivor!.experience).toBe(15);
    });

    it('captures territory on win', () => {
      cm.selectTerritory('cuizhu');
      cm.processBattleResult(makeBattleResult({ won: true, survivingPlayerSquads: [] }));
      const cuizhu = cm.getTerritoryManager().get('cuizhu')!;
      expect(cuizhu.owner).toBe('player');
    });

    it('does not capture territory on loss', () => {
      cm.selectTerritory('cuizhu');
      cm.processBattleResult(makeBattleResult({ won: false, survivingPlayerSquads: [] }));
      const cuizhu = cm.getTerritoryManager().get('cuizhu')!;
      expect(cuizhu.owner).toBe('enemy');
    });

    it('sets generalAlive to false on general death', () => {
      cm.processBattleResult(makeBattleResult({ generalAlive: false }));
      expect(cm.getState().roster.generalAlive).toBe(false);
    });

    it('increments stats', () => {
      cm.selectTerritory('cuizhu');
      cm.processBattleResult(makeBattleResult({
        won: true,
        totalEnemiesDefeated: 100,
        totalPlayerLosses: 20,
      }));
      expect(cm.getState().totalEnemiesDefeated).toBe(100);
      expect(cm.getState().totalSoldiersLost).toBe(20);
      expect(cm.getState().battlesWon).toBe(1);
    });

    it('adds captured enemy squads to roster', () => {
      cm.processBattleResult(makeBattleResult({
        capturedEnemySquads: [
          { type: UnitType.LIGHT_CAVALRY, size: 20, experience: 30 },
        ],
      }));
      const captured = cm.getState().roster.squads.find(s => s.isCaptured);
      expect(captured).toBeDefined();
      expect(captured!.type).toBe(UnitType.LIGHT_CAVALRY);
      expect(captured!.capturedEffectiveness).toBe(0.5);
    });

    it('clears selectedTerritoryId after processing', () => {
      cm.selectTerritory('cuizhu');
      cm.processBattleResult(makeBattleResult());
      expect(cm.getState().selectedTerritoryId).toBeNull();
    });
  });

  describe('checkRunEnd()', () => {
    it('returns lose when general is dead', () => {
      cm.getState().roster.generalAlive = false;
      expect(cm.checkRunEnd()).toBe('lose');
    });

    it('returns win at 15 territories', () => {
      cm.getState().territoriesConquered = CAMPAIGN_WIN_TERRITORIES;
      expect(cm.checkRunEnd()).toBe('win');
    });

    it('returns continue otherwise', () => {
      expect(cm.checkRunEnd()).toBe('continue');
    });
  });

  describe('calculateUnlockPoints()', () => {
    it('correct formula: territories*10 + battles*5 + won?50 + bonus*15', () => {
      cm.getState().territoriesConquered = 7;
      cm.getState().battlesWon = 6;
      cm.getState().bonusObjectivesCompleted = ['no_squad_lost'];
      // Not a win (< 15 territories)
      expect(cm.calculateUnlockPoints()).toBe(7 * 10 + 6 * 5 + 0 + 1 * 15);
    });

    it('adds 50 for winning', () => {
      cm.getState().territoriesConquered = CAMPAIGN_WIN_TERRITORIES;
      cm.getState().battlesWon = 14;
      expect(cm.calculateUnlockPoints()).toBe(
        CAMPAIGN_WIN_TERRITORIES * 10 + 14 * 5 + 50 + 0
      );
    });
  });

  describe('serialize/deserialize', () => {
    it('round-trips correctly', () => {
      cm.advanceTurn();
      cm.selectTerritory('cuizhu');
      const serialized = cm.serialize();

      const cm2 = new CampaignManager(eventBus);
      cm2.deserialize(serialized);

      const state2 = cm2.getState();
      expect(state2.turn).toBe(2);
      expect(state2.startingTerritoryId).toBe('longmen');
      expect(state2.roster.squads).toHaveLength(serialized.roster.squads.length);
    });

    it('restores territory manager state', () => {
      cm.advanceTurn();
      const serialized = cm.serialize();

      const cm2 = new CampaignManager(eventBus);
      cm2.deserialize(serialized);

      const longmen = cm2.getTerritoryManager().get('longmen')!;
      expect(longmen.owner).toBe('player');
    });

    it('serialized state is a deep copy', () => {
      const serialized = cm.serialize();
      serialized.turn = 999;
      expect(cm.getState().turn).toBe(1);
    });
  });
});
