import { describe, it, expect } from 'vitest';
import { SaveValidator } from '../../persistence/SaveValidator';
import { migrate, CURRENT_SAVE_VERSION } from '../../persistence/MigrationChain';
import type { CampaignState } from '../CampaignTypes';
import type { SaveFile } from '../../persistence/SaveTypes';
import { SAVE_VERSION } from '../../../constants';

function createMockCampaignState(): CampaignState {
  return {
    runId: 'test-run-1',
    seed: 42,
    difficulty: 'normal',
    mode: 'ironman',
    territories: [
      {
        id: 'longmen',
        name: 'Longmen',
        chineseName: '龍門',
        type: 7,
        adjacentIds: ['cuizhu', 'baima'],
        mapPosition: { x: 0.1, y: 0.1 },
        terrainTemplate: 'RIVER_CROSSING',
        garrisonStrength: 5,
        garrisonBaseExp: 20,
        owner: 'player',
        conqueredTurn: 1,
      },
    ],
    startingTerritoryId: 'longmen',
    roster: {
      squads: [
        {
          squadId: 1,
          type: 0,
          size: 120,
          maxSize: 120,
          experience: 10,
          morale: 70,
          fatigue: 0,
          trainingTurnsRemaining: 0,
          isCaptured: false,
          capturedEffectiveness: 1.0,
        },
      ],
      generalAlive: true,
      generalExperience: 0,
      nextSquadId: 2,
    },
    resources: { gold: 300, population: 200, horses: 20, iron: 10, food: 100 },
    turn: 3,
    territoriesConquered: 1,
    battlesWon: 1,
    battlesLost: 0,
    totalEnemiesDefeated: 50,
    totalSoldiersLost: 10,
    bonusObjectivesCompleted: [],
    phase: 1,
    selectedTerritoryId: null,
    pendingEvent: null,
  };
}

function createMockCampaignSaveFile(overrides?: Partial<SaveFile>): SaveFile {
  const state = createMockCampaignState();
  return {
    version: SAVE_VERSION,
    timestamp: Date.now(),
    type: 'campaign',
    meta: {
      slotId: 'ironman-campaign',
      name: 'Campaign T3',
      timestamp: Date.now(),
      tick: 0,
      templateId: '',
      playerTroops: 120,
      enemyTroops: 0,
    },
    campaign: {
      campaignState: state,
      wasLoaded: false,
    },
    ...overrides,
  };
}

describe('CampaignSave', () => {
  describe('SaveValidator — campaign type', () => {
    it('validates a well-formed campaign save', () => {
      const save = createMockCampaignSaveFile();
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects campaign save missing campaign data', () => {
      const save = createMockCampaignSaveFile();
      delete (save as unknown as Record<string, unknown>).campaign;
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing "campaign"'))).toBe(true);
    });

    it('rejects campaign save missing campaignState', () => {
      const save = createMockCampaignSaveFile();
      (save.campaign as unknown as Record<string, unknown>).campaignState = null;
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('campaignState must be an object'))).toBe(true);
    });

    it('rejects campaign save missing wasLoaded', () => {
      const save = createMockCampaignSaveFile();
      delete (save.campaign as unknown as Record<string, unknown>).wasLoaded;
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('wasLoaded must be a boolean'))).toBe(true);
    });

    it('validates campaignState required fields', () => {
      const save = createMockCampaignSaveFile();
      const cs = (save.campaign as unknown as Record<string, unknown>).campaignState as Record<string, unknown>;
      delete cs.runId;
      delete cs.seed;
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('runId'))).toBe(true);
      expect(result.errors.some(e => e.includes('seed'))).toBe(true);
    });

    it('validates campaignState.territories is an array', () => {
      const save = createMockCampaignSaveFile();
      const cs = (save.campaign as unknown as Record<string, unknown>).campaignState as Record<string, unknown>;
      cs.territories = 'not-an-array';
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('territories must be an array'))).toBe(true);
    });

    it('validates campaignState.roster is an object', () => {
      const save = createMockCampaignSaveFile();
      const cs = (save.campaign as unknown as Record<string, unknown>).campaignState as Record<string, unknown>;
      cs.roster = null;
      const result = SaveValidator.validate(save);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('roster must be an object'))).toBe(true);
    });

    it('still validates battle saves correctly', () => {
      const battleSave: SaveFile = {
        version: SAVE_VERSION,
        timestamp: Date.now(),
        type: 'battle',
        meta: {
          slotId: 'test',
          name: 'test',
          timestamp: Date.now(),
          tick: 100,
          templateId: 'OPEN_PLAINS',
          playerTroops: 500,
          enemyTroops: 400,
        },
        battle: {
          terrainSeed: 123,
          templateId: 'OPEN_PLAINS',
          gameState: { tickNumber: 100, paused: false, speedMultiplier: 1, battleTimeTicks: 100 },
          units: [],
          nextUnitId: 1,
          orders: [],
          supply: { armies: [] },
          surrender: { teamStates: [] },
          command: { messengers: [], nextMessengerId: 1, queue: [] },
          weather: { currentWeather: 0, rngState: 0, ticksSinceLastShift: 0 },
          timeOfDay: { startTime: 0.3, lastPhaseChangeTick: 0 },
          environment: { weather: 0, timeOfDay: 0, windDirection: 0, visibility: 1 },
          deployment: { phase: 2, battleTicks: 100, reservesSpawned: false },
          retreat: { retreatingTeams: [], retreatStartTick: [], lastStalemateCheck: 0 },
          battleEventLogger: { events: [], moraleHistory: [], supplyHistory: [], casualtyHistory: [], startTick: 0, endTick: 100, sampleInterval: 20 },
          battleStartTick: 0,
          battleEnded: false,
        },
      };
      const result = SaveValidator.validate(battleSave);
      expect(result.valid).toBe(true);
    });
  });

  describe('MigrationChain', () => {
    it('CURRENT_SAVE_VERSION is 1.1.0', () => {
      expect(CURRENT_SAVE_VERSION).toBe('1.1.0');
    });

    it('accepts version 1.0.0 and migrates to 1.1.0', () => {
      const data: Record<string, unknown> = {
        version: '1.0.0',
        type: 'battle',
        timestamp: Date.now(),
        meta: {},
        battle: {},
      };
      const result = migrate(data);
      expect(result.version).toBe('1.1.0');
    });

    it('accepts version 1.1.0 without changes', () => {
      const data: Record<string, unknown> = {
        version: '1.1.0',
        type: 'campaign',
        timestamp: Date.now(),
        meta: {},
        campaign: { campaignState: {}, wasLoaded: false },
      };
      const result = migrate(data);
      expect(result.version).toBe('1.1.0');
    });

    it('adds wasLoaded to old campaign saves during migration', () => {
      const data: Record<string, unknown> = {
        version: '1.0.0',
        type: 'campaign',
        campaign: { campaignState: createMockCampaignState() },
      };
      migrate(data);
      const campaign = data.campaign as Record<string, unknown>;
      expect(campaign.wasLoaded).toBe(false);
    });

    it('throws for unknown version', () => {
      const data = { version: '99.0.0' };
      expect(() => migrate(data)).toThrow('Unknown save version');
    });
  });

  describe('SAVE_VERSION constant', () => {
    it('matches CURRENT_SAVE_VERSION', () => {
      expect(SAVE_VERSION).toBe(CURRENT_SAVE_VERSION);
    });
  });
});
