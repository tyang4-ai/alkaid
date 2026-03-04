import { describe, it, expect } from 'vitest';
import { PERSONALITY_WEIGHTS, getPersonalityName } from '../AIPersonality';
import { AIPersonalityType } from '../AITypes';

describe('AIPersonality', () => {
  const personalities = [
    AIPersonalityType.AGGRESSIVE,
    AIPersonalityType.DEFENSIVE,
    AIPersonalityType.CUNNING,
    AIPersonalityType.BALANCED,
  ] as const;

  it('each personality has valid weights (all numeric 0-1 range where applicable)', () => {
    for (const p of personalities) {
      const w = PERSONALITY_WEIGHTS[p];
      expect(w.aggressiveness).toBeGreaterThanOrEqual(0);
      expect(w.aggressiveness).toBeLessThanOrEqual(1);
      expect(w.caution).toBeGreaterThanOrEqual(0);
      expect(w.caution).toBeLessThanOrEqual(1);
      expect(w.flankTendency).toBeGreaterThanOrEqual(0);
      expect(w.flankTendency).toBeLessThanOrEqual(1);
      expect(w.decisionInterval).toBeGreaterThan(0);
    }
  });

  it('role biases sum to ~1.0 for each personality', () => {
    for (const p of personalities) {
      const w = PERSONALITY_WEIGHTS[p];
      const sum = w.attackerBias + w.defenderBias + w.flankerBias + w.reserveBias;
      expect(sum).toBeCloseTo(1.0, 1);
    }
  });

  it('aggressive has highest aggressiveness', () => {
    const agg = PERSONALITY_WEIGHTS[AIPersonalityType.AGGRESSIVE].aggressiveness;
    expect(agg).toBeGreaterThan(PERSONALITY_WEIGHTS[AIPersonalityType.DEFENSIVE].aggressiveness);
    expect(agg).toBeGreaterThan(PERSONALITY_WEIGHTS[AIPersonalityType.CUNNING].aggressiveness);
    expect(agg).toBeGreaterThanOrEqual(PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED].aggressiveness);
  });

  it('defensive has highest caution', () => {
    const cau = PERSONALITY_WEIGHTS[AIPersonalityType.DEFENSIVE].caution;
    expect(cau).toBeGreaterThan(PERSONALITY_WEIGHTS[AIPersonalityType.AGGRESSIVE].caution);
    expect(cau).toBeGreaterThan(PERSONALITY_WEIGHTS[AIPersonalityType.CUNNING].caution);
    expect(cau).toBeGreaterThanOrEqual(PERSONALITY_WEIGHTS[AIPersonalityType.BALANCED].caution);
  });

  it('all 4 produce distinct weight vectors', () => {
    const values = personalities.map(p => JSON.stringify(PERSONALITY_WEIGHTS[p]));
    const unique = new Set(values);
    expect(unique.size).toBe(4);
  });

  it('getPersonalityName returns Chinese+English names', () => {
    expect(getPersonalityName(AIPersonalityType.AGGRESSIVE)).toContain('Sun Ce');
    expect(getPersonalityName(AIPersonalityType.DEFENSIVE)).toContain('Sima Yi');
    expect(getPersonalityName(AIPersonalityType.CUNNING)).toContain('Zhuge Liang');
    expect(getPersonalityName(AIPersonalityType.BALANCED)).toContain('Cao Cao');
  });
});
