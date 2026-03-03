import { describe, it, expect } from 'vitest';
import { SaveValidator } from '../SaveValidator';

describe('SaveValidator', () => {
  const validSaveFile = {
    version: '1.0.0',
    timestamp: Date.now(),
    type: 'battle',
    meta: {
      slotId: 'test',
      name: 'Test Save',
      timestamp: Date.now(),
      tick: 100,
      templateId: 'valley_clash',
      playerTroops: 500,
      enemyTroops: 600,
    },
    battle: {
      terrainSeed: 42,
      templateId: 'valley_clash',
      gameState: { tickNumber: 100, paused: false, speedMultiplier: 1, battleTimeTicks: 100 },
      units: [],
      nextUnitId: 1,
      orders: [],
      supply: { armies: [] },
      surrender: { teamStates: [] },
      command: { messengers: [], nextMessengerId: 1, queue: [] },
      weather: { currentWeather: 0, rngState: 42, ticksSinceLastShift: 0 },
      timeOfDay: { startTime: 0, lastPhaseChangeTick: 0 },
      environment: { weather: 0, timeOfDay: 0, windDirection: 0, visibility: 1 },
      deployment: { phase: 2, battleTicks: 100, reservesSpawned: true },
      retreat: { retreatingTeams: [], retreatStartTick: [], lastStalemateCheck: 0 },
      battleEventLogger: {
        events: [], moraleHistory: [], supplyHistory: [], casualtyHistory: [],
        startTick: 0, endTick: 100, sampleInterval: 10,
      },
      battleStartTick: 0,
      battleEnded: false,
    },
  };

  it('accepts a valid battle save file', () => {
    const result = SaveValidator.validate(validSaveFile);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing version field', () => {
    const { version: _, ...noVersion } = validSaveFile;
    const result = SaveValidator.validate(noVersion);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('rejects missing battle field when type is battle', () => {
    const { battle: _, ...noBattle } = validSaveFile;
    const result = SaveValidator.validate(noBattle);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('battle'))).toBe(true);
  });

  it('rejects wrong type on timestamp', () => {
    const result = SaveValidator.validate({ ...validSaveFile, timestamp: 'not a number' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('timestamp'))).toBe(true);
  });

  it('rejects empty object', () => {
    const result = SaveValidator.validate({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects null', () => {
    const result = SaveValidator.validate(null);
    expect(result.valid).toBe(false);
  });
});
