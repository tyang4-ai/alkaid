import { AIPersonalityType, type PersonalityWeights } from './AITypes';

export const PERSONALITY_WEIGHTS: Record<AIPersonalityType, PersonalityWeights> = {
  // 孫策 Sun Ce — Aggressive: charges early, pursues relentlessly
  [AIPersonalityType.AGGRESSIVE]: Object.freeze({
    engagementTick: 40,
    decisionInterval: 15,
    attackerBias: 0.55,
    defenderBias: 0.10,
    flankerBias: 0.20,
    reserveBias: 0.15,
    aggressiveness: 0.9,
    caution: 0.2,
    flankTendency: 0.3,
    terrainExploitation: 0.3,
    supplyRaidPriority: 0.2,
    pursuitDesire: 0.9,
    ambushTendency: 0.1,
    adaptability: 0.3,
    chargePreference: 0.7,
    pressThreshold: 0.8,
    retreatThreshold: 0.3,
    desperateThreshold: 0.6,
    generalSafeDistance: 15,
  }),

  // 司馬懿 Sima Yi — Defensive: holds terrain, waits for mistakes
  [AIPersonalityType.DEFENSIVE]: Object.freeze({
    engagementTick: 200,
    decisionInterval: 25,
    attackerBias: 0.20,
    defenderBias: 0.45,
    flankerBias: 0.15,
    reserveBias: 0.20,
    aggressiveness: 0.2,
    caution: 0.9,
    flankTendency: 0.2,
    terrainExploitation: 0.9,
    supplyRaidPriority: 0.1,
    pursuitDesire: 0.2,
    ambushTendency: 0.3,
    adaptability: 0.4,
    chargePreference: 0.2,
    pressThreshold: 1.5,
    retreatThreshold: 0.6,
    desperateThreshold: 0.35,
    generalSafeDistance: 40,
  }),

  // 諸葛亮 Zhuge Liang — Cunning: flanks, ambushes, raids supply
  [AIPersonalityType.CUNNING]: Object.freeze({
    engagementTick: 120,
    decisionInterval: 25,
    attackerBias: 0.25,
    defenderBias: 0.20,
    flankerBias: 0.30,
    reserveBias: 0.25,
    aggressiveness: 0.5,
    caution: 0.5,
    flankTendency: 0.8,
    terrainExploitation: 0.95,
    supplyRaidPriority: 0.8,
    pursuitDesire: 0.4,
    ambushTendency: 0.9,
    adaptability: 0.8,
    chargePreference: 0.3,
    pressThreshold: 1.0,
    retreatThreshold: 0.5,
    desperateThreshold: 0.45,
    generalSafeDistance: 30,
  }),

  // 曹操 Cao Cao — Balanced: adapts to the situation
  [AIPersonalityType.BALANCED]: Object.freeze({
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
  }),
};

const PERSONALITY_NAMES: Record<AIPersonalityType, string> = {
  [AIPersonalityType.AGGRESSIVE]: '孫策 Sun Ce',
  [AIPersonalityType.DEFENSIVE]: '司馬懿 Sima Yi',
  [AIPersonalityType.CUNNING]: '諸葛亮 Zhuge Liang',
  [AIPersonalityType.BALANCED]: '曹操 Cao Cao',
};

export function getPersonalityName(type: AIPersonalityType): string {
  return PERSONALITY_NAMES[type] ?? 'Unknown';
}
