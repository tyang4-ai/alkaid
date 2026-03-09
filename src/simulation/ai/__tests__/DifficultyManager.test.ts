import { describe, it, expect } from 'vitest';
import { DifficultyManager } from '../DifficultyManager';
import { DifficultyLevel } from '../../../constants';
import type { PersonalityWeights } from '../AITypes';

const baseWeights: PersonalityWeights = {
  engagementTick: 80,
  decisionInterval: 20,
  attackerBias: 0.30,
  defenderBias: 0.25,
  flankerBias: 0.25,
  reserveBias: 0.20,
  aggressiveness: 0.5,
  caution: 0.5,
  flankTendency: 0.5,
  terrainExploitation: 0.5,
  supplyRaidPriority: 0.4,
  pursuitDesire: 0.5,
  ambushTendency: 0.3,
  adaptability: 0.9,
  chargePreference: 0.4,
  pressThreshold: 1.1,
  retreatThreshold: 0.5,
  desperateThreshold: 0.45,
  generalSafeDistance: 25,
};

describe('DifficultyManager', () => {
  const dm = new DifficultyManager();

  it('returns base weights unchanged for MEDIUM', () => {
    const result = dm.applyModifiers(baseWeights, DifficultyLevel.MEDIUM);
    expect(result.aggressiveness).toBe(baseWeights.aggressiveness);
    expect(result.decisionInterval).toBe(baseWeights.decisionInterval);
  });

  it('makes Easy AI slower and less aggressive', () => {
    const result = dm.applyModifiers(baseWeights, DifficultyLevel.EASY);
    expect(result.decisionInterval).toBe(30); // 20 * 1.5
    expect(result.aggressiveness).toBeLessThan(baseWeights.aggressiveness);
    expect(result.caution).toBeGreaterThan(baseWeights.caution);
  });

  it('makes Brutal AI more aggressive and faster', () => {
    const result = dm.applyModifiers(baseWeights, DifficultyLevel.BRUTAL);
    expect(result.decisionInterval).toBe(16); // 20 * 0.8
    expect(result.aggressiveness).toBeGreaterThan(baseWeights.aggressiveness);
    expect(result.terrainExploitation).toBeGreaterThan(baseWeights.terrainExploitation);
  });

  it('clamps modified values to [0,1]', () => {
    const highWeights = { ...baseWeights, aggressiveness: 0.9, terrainExploitation: 0.9 };
    const result = dm.applyModifiers(highWeights, DifficultyLevel.BRUTAL);
    expect(result.aggressiveness).toBeLessThanOrEqual(1);
    expect(result.terrainExploitation).toBeLessThanOrEqual(1);
  });

  it('returns correct temperature per level', () => {
    expect(dm.getTemperature(DifficultyLevel.EASY)).toBe(1.5);
    expect(dm.getTemperature(DifficultyLevel.MEDIUM)).toBe(1.0);
    expect(dm.getTemperature(DifficultyLevel.HARD)).toBe(0.7);
    expect(dm.getTemperature(DifficultyLevel.BRUTAL)).toBe(0.5);
  });

  it('enables adaptation only for Hard and Brutal', () => {
    expect(dm.isAdaptationEnabled(DifficultyLevel.EASY)).toBe(false);
    expect(dm.isAdaptationEnabled(DifficultyLevel.MEDIUM)).toBe(false);
    expect(dm.isAdaptationEnabled(DifficultyLevel.HARD)).toBe(true);
    expect(dm.isAdaptationEnabled(DifficultyLevel.BRUTAL)).toBe(true);
  });

  it('prefers RL only for Hard and Brutal', () => {
    expect(dm.prefersRL(DifficultyLevel.EASY)).toBe(false);
    expect(dm.prefersRL(DifficultyLevel.MEDIUM)).toBe(false);
    expect(dm.prefersRL(DifficultyLevel.HARD)).toBe(true);
    expect(dm.prefersRL(DifficultyLevel.BRUTAL)).toBe(true);
  });

  it('does not mutate original weights', () => {
    const original = { ...baseWeights };
    dm.applyModifiers(baseWeights, DifficultyLevel.BRUTAL);
    expect(baseWeights).toEqual(original);
  });
});
