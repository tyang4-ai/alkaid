import { describe, it, expect, beforeEach } from 'vitest';
import { RecruitmentManager } from '../RecruitmentManager';
import { UnitType, UNIT_TYPE_CONFIGS, CAMPAIGN_MAX_SQUADS, CAMPAIGN_MAX_SIEGE, CAMPAIGN_MAX_CAVALRY, CAMPAIGN_MAX_ELITE_GUARD } from '../../../constants';
import type { CampaignSquad, Resources, ArmyRoster, CampaignState } from '../CampaignTypes';

function makeResources(overrides: Partial<Resources> = {}): Resources {
  return { gold: 2000, population: 1000, horses: 100, iron: 100, food: 200, ...overrides };
}

function makeSquad(overrides: Partial<CampaignSquad> = {}): CampaignSquad {
  return {
    squadId: 1,
    type: UnitType.JI_HALBERDIERS,
    size: 80,
    maxSize: 120,
    experience: 50,
    morale: 70,
    fatigue: 30,
    trainingTurnsRemaining: 0,
    isCaptured: false,
    capturedEffectiveness: 1.0,
    ...overrides,
  };
}

function makeRoster(squads: CampaignSquad[] = []): ArmyRoster {
  return {
    squads,
    generalAlive: true,
    generalExperience: 0,
    nextSquadId: squads.length + 1,
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
    roster: makeRoster(),
    resources: makeResources(),
    turn: 1,
    territoriesConquered: 1,
    battlesWon: 0,
    battlesLost: 0,
    totalEnemiesDefeated: 0,
    totalSoldiersLost: 0,
    bonusObjectivesCompleted: [],
    phase: 2,
    selectedTerritoryId: null,
    pendingEvent: null,
    ...overrides,
  };
}

const ALL_LAND_TYPES: UnitType[] = [
  UnitType.JI_HALBERDIERS, UnitType.DAO_SWORDSMEN, UnitType.NU_CROSSBOWMEN,
  UnitType.GONG_ARCHERS, UnitType.LIGHT_CAVALRY, UnitType.HEAVY_CAVALRY,
  UnitType.HORSE_ARCHERS, UnitType.SIEGE_ENGINEERS, UnitType.ELITE_GUARD, UnitType.SCOUTS,
];

describe('RecruitmentManager', () => {
  let rm: RecruitmentManager;

  beforeEach(() => {
    rm = new RecruitmentManager();
  });

  describe('canRecruit()', () => {
    it('allows recruitment with sufficient resources', () => {
      const result = rm.canRecruit(UnitType.JI_HALBERDIERS, makeResources(), makeRoster(), ALL_LAND_TYPES);
      expect(result.allowed).toBe(true);
    });

    it('rejects unlocked type', () => {
      const result = rm.canRecruit(UnitType.GONG_ARCHERS, makeResources(), makeRoster(), [UnitType.JI_HALBERDIERS]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not unlocked');
    });

    it('rejects insufficient gold', () => {
      const result = rm.canRecruit(UnitType.JI_HALBERDIERS, makeResources({ gold: 10 }), makeRoster(), ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('gold');
    });

    it('rejects insufficient population', () => {
      const result = rm.canRecruit(UnitType.JI_HALBERDIERS, makeResources({ population: 0 }), makeRoster(), ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('population');
    });

    it('rejects insufficient horses for cavalry', () => {
      const result = rm.canRecruit(UnitType.LIGHT_CAVALRY, makeResources({ horses: 0 }), makeRoster(), ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('horses');
    });

    it('rejects insufficient iron', () => {
      const result = rm.canRecruit(UnitType.DAO_SWORDSMEN, makeResources({ iron: 0 }), makeRoster(), ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('iron');
    });
  });

  describe('recruit()', () => {
    it('creates squad and deducts resources', () => {
      const state = makeState();
      const goldBefore = state.resources.gold;
      const squad = rm.recruit(UnitType.JI_HALBERDIERS, state, ALL_LAND_TYPES);

      expect(squad).not.toBeNull();
      expect(squad!.type).toBe(UnitType.JI_HALBERDIERS);
      expect(squad!.size).toBe(UNIT_TYPE_CONFIGS[UnitType.JI_HALBERDIERS].maxSize);
      expect(squad!.trainingTurnsRemaining).toBe(1);
      expect(state.resources.gold).toBe(goldBefore - 80);
      expect(state.roster.squads).toHaveLength(1);
    });

    it('returns null when cannot recruit', () => {
      const state = makeState({ resources: makeResources({ gold: 0 }) });
      expect(rm.recruit(UnitType.JI_HALBERDIERS, state, ALL_LAND_TYPES)).toBeNull();
    });

    it('assigns correct training turns', () => {
      const state = makeState();
      const gong = rm.recruit(UnitType.GONG_ARCHERS, state, ALL_LAND_TYPES);
      expect(gong!.trainingTurnsRemaining).toBe(2);

      const heavy = rm.recruit(UnitType.HEAVY_CAVALRY, state, ALL_LAND_TYPES);
      expect(heavy!.trainingTurnsRemaining).toBe(3);
    });
  });

  describe('army limits', () => {
    it('enforces 15 squad limit', () => {
      const squads = Array.from({ length: CAMPAIGN_MAX_SQUADS }, (_, i) =>
        makeSquad({ squadId: i + 1 })
      );
      const roster = makeRoster(squads);
      const result = rm.canRecruit(UnitType.JI_HALBERDIERS, makeResources(), roster, ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(`${CAMPAIGN_MAX_SQUADS}`);
    });

    it('enforces 3 siege limit', () => {
      const squads = Array.from({ length: CAMPAIGN_MAX_SIEGE }, (_, i) =>
        makeSquad({ squadId: i + 1, type: UnitType.SIEGE_ENGINEERS })
      );
      const roster = makeRoster(squads);
      const result = rm.canRecruit(UnitType.SIEGE_ENGINEERS, makeResources(), roster, ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(`${CAMPAIGN_MAX_SIEGE}`);
    });

    it('enforces 5 cavalry limit', () => {
      const squads = Array.from({ length: CAMPAIGN_MAX_CAVALRY }, (_, i) =>
        makeSquad({ squadId: i + 1, type: UnitType.LIGHT_CAVALRY })
      );
      const roster = makeRoster(squads);
      const result = rm.canRecruit(UnitType.LIGHT_CAVALRY, makeResources(), roster, ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(`${CAMPAIGN_MAX_CAVALRY}`);
    });

    it('enforces 1 elite guard limit', () => {
      const squads = [makeSquad({ squadId: 1, type: UnitType.ELITE_GUARD })];
      const roster = makeRoster(squads);
      const result = rm.canRecruit(UnitType.ELITE_GUARD, makeResources(), roster, ALL_LAND_TYPES);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(`${CAMPAIGN_MAX_ELITE_GUARD}`);
    });
  });

  describe('canReinforce() / reinforce()', () => {
    it('allows reinforcement when below max', () => {
      const squad = makeSquad({ size: 80, maxSize: 120 });
      const result = rm.canReinforce(squad, makeResources());
      expect(result.allowed).toBe(true);
    });

    it('rejects reinforcement at full strength', () => {
      const squad = makeSquad({ size: 120, maxSize: 120 });
      expect(rm.canReinforce(squad, makeResources()).allowed).toBe(false);
    });

    it('rejects reinforcement in training', () => {
      const squad = makeSquad({ size: 80, trainingTurnsRemaining: 1 });
      expect(rm.canReinforce(squad, makeResources()).allowed).toBe(false);
    });

    it('reinforce cost is 50% of gold', () => {
      const squad = makeSquad({ size: 80, maxSize: 120, type: UnitType.JI_HALBERDIERS });
      const resources = makeResources();
      const goldBefore = resources.gold;
      rm.reinforce(squad, resources);
      // 80 gold * 0.5 = 40 gold
      expect(resources.gold).toBe(goldBefore - 40);
    });

    it('reinforce dilutes experience', () => {
      const squad = makeSquad({ size: 80, maxSize: 120, experience: 60 });
      const resources = makeResources();
      rm.reinforce(squad, resources);
      // newExp = floor((80 * 60 + 40 * 0) / 120) = floor(4800/120) = 40
      expect(squad.experience).toBe(40);
      expect(squad.size).toBe(120);
    });

    it('rejects insufficient gold for reinforcement', () => {
      const squad = makeSquad({ size: 80, maxSize: 120, type: UnitType.JI_HALBERDIERS });
      // Reinforce cost = ceil(80 * 0.5) = 40
      expect(rm.canReinforce(squad, makeResources({ gold: 10 })).allowed).toBe(false);
    });

    it('rejects insufficient population for reinforcement', () => {
      const squad = makeSquad({ size: 80, maxSize: 120 });
      // Needs 40 population
      expect(rm.canReinforce(squad, makeResources({ population: 10 })).allowed).toBe(false);
    });
  });

  describe('canPromote() / promote()', () => {
    it('allows promotion with exp >= 80', () => {
      const squad = makeSquad({ experience: 80 });
      const result = rm.canPromote(squad, makeResources(), makeRoster());
      expect(result.allowed).toBe(true);
    });

    it('rejects promotion with exp < 80', () => {
      const squad = makeSquad({ experience: 79 });
      expect(rm.canPromote(squad, makeResources(), makeRoster()).allowed).toBe(false);
    });

    it('rejects promoting already Elite Guard', () => {
      const squad = makeSquad({ type: UnitType.ELITE_GUARD, experience: 90 });
      expect(rm.canPromote(squad, makeResources(), makeRoster()).allowed).toBe(false);
    });

    it('promote costs 400 gold + 15 iron', () => {
      const squad = makeSquad({ experience: 85 });
      const resources = makeResources();
      const goldBefore = resources.gold;
      const ironBefore = resources.iron;
      rm.promote(squad, resources);
      expect(resources.gold).toBe(goldBefore - 400);
      expect(resources.iron).toBe(ironBefore - 15);
    });

    it('promote changes type to ELITE_GUARD', () => {
      const squad = makeSquad({ experience: 85 });
      rm.promote(squad, makeResources());
      expect(squad.type).toBe(UnitType.ELITE_GUARD);
      expect(squad.morale).toBe(85);
    });

    it('rejects promotion at elite guard limit', () => {
      const squads = [makeSquad({ squadId: 1, type: UnitType.ELITE_GUARD })];
      const squad = makeSquad({ squadId: 2, experience: 85 });
      expect(rm.canPromote(squad, makeResources(), makeRoster(squads)).allowed).toBe(false);
    });
  });

  describe('dismiss()', () => {
    it('recovers 25% gold cost', () => {
      // Ji Halberdiers cost 80 gold → 25% = 20
      const squad = makeSquad({ type: UnitType.JI_HALBERDIERS });
      expect(rm.dismiss(squad).goldRecovered).toBe(20);
    });

    it('recovers for expensive units', () => {
      // Siege Engineers cost 500 → 25% = 125
      const squad = makeSquad({ type: UnitType.SIEGE_ENGINEERS });
      expect(rm.dismiss(squad).goldRecovered).toBe(125);
    });
  });

  describe('restArmy()', () => {
    it('resets fatigue to 0 and morale to baseline', () => {
      const squads = [
        makeSquad({ fatigue: 80, morale: 30 }),
        makeSquad({ squadId: 2, type: UnitType.ELITE_GUARD, fatigue: 50, morale: 40 }),
      ];
      const roster = makeRoster(squads);
      rm.restArmy(roster);

      expect(squads[0].fatigue).toBe(0);
      expect(squads[0].morale).toBe(70);
      expect(squads[1].fatigue).toBe(0);
      expect(squads[1].morale).toBe(85);
    });
  });

  describe('calcReinforcedExp()', () => {
    it('dilutes correctly', () => {
      expect(RecruitmentManager.calcReinforcedExp(80, 60, 40)).toBe(40);
    });

    it('returns 0 for empty squad', () => {
      expect(RecruitmentManager.calcReinforcedExp(0, 0, 0)).toBe(0);
    });

    it('no dilution when adding 0', () => {
      expect(RecruitmentManager.calcReinforcedExp(100, 50, 0)).toBe(50);
    });
  });

  describe('checkArmyLimits()', () => {
    it('valid when under all limits', () => {
      const result = rm.checkArmyLimits(makeRoster([makeSquad()]));
      expect(result.valid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('reports multiple violations', () => {
      const squads = Array.from({ length: CAMPAIGN_MAX_SQUADS }, (_, i) =>
        makeSquad({ squadId: i + 1, type: UnitType.SIEGE_ENGINEERS })
      );
      const result = rm.checkArmyLimits(makeRoster(squads), UnitType.SIEGE_ENGINEERS);
      expect(result.valid).toBe(false);
      expect(result.violations.length).toBeGreaterThanOrEqual(2); // over total + over siege
    });
  });
});
