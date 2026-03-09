import { DifficultyLevel, DIFFICULTY_CONFIG } from '../../constants';
import type { PersonalityWeights } from './AITypes';

export class DifficultyManager {
  applyModifiers(baseWeights: PersonalityWeights, level: DifficultyLevel): PersonalityWeights {
    const config = DIFFICULTY_CONFIG[level];
    const modified = { ...baseWeights };

    // Scale decision interval
    modified.decisionInterval = Math.round(baseWeights.decisionInterval * config.decisionIntervalMult);

    // Easy: reduce aggression and exploitation
    if (level === DifficultyLevel.EASY) {
      modified.aggressiveness *= 0.6;
      modified.flankTendency *= 0.5;
      modified.terrainExploitation *= 0.5;
      modified.supplyRaidPriority *= 0.3;
      modified.ambushTendency *= 0.3;
      modified.chargePreference *= 0.5;
      modified.caution *= 1.5;
    }

    // Hard: slight boosts
    if (level === DifficultyLevel.HARD) {
      modified.terrainExploitation = Math.min(1, baseWeights.terrainExploitation * 1.2);
      modified.adaptability = Math.min(1, baseWeights.adaptability * 1.2);
    }

    // Brutal: significant boosts
    if (level === DifficultyLevel.BRUTAL) {
      modified.aggressiveness = Math.min(1, baseWeights.aggressiveness * 1.3);
      modified.terrainExploitation = Math.min(1, baseWeights.terrainExploitation * 1.4);
      modified.flankTendency = Math.min(1, baseWeights.flankTendency * 1.3);
      modified.supplyRaidPriority = Math.min(1, baseWeights.supplyRaidPriority * 1.3);
      modified.adaptability = Math.min(1, baseWeights.adaptability * 1.3);
      modified.chargePreference = Math.min(1, baseWeights.chargePreference * 1.2);
    }

    return modified;
  }

  getTemperature(level: DifficultyLevel): number {
    return DIFFICULTY_CONFIG[level].temperature;
  }

  isAdaptationEnabled(level: DifficultyLevel): boolean {
    return DIFFICULTY_CONFIG[level].adaptationEnabled;
  }

  prefersRL(level: DifficultyLevel): boolean {
    return DIFFICULTY_CONFIG[level].preferRL;
  }
}
