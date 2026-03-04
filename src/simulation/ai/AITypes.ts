export const AIPersonalityType = {
  AGGRESSIVE: 0,
  DEFENSIVE: 1,
  CUNNING: 2,
  BALANCED: 3,
} as const;
export type AIPersonalityType = (typeof AIPersonalityType)[keyof typeof AIPersonalityType];

export const TacticalRole = {
  ATTACKER: 0,
  DEFENDER: 1,
  FLANKER: 2,
  RESERVE: 3,
  SCOUT: 4,
  SUPPLY_RAIDER: 5,
  GUARD: 6,
} as const;
export type TacticalRole = (typeof TacticalRole)[keyof typeof TacticalRole];

export const AIPhase = {
  OPENING: 0,
  ENGAGEMENT: 1,
  PRESSING: 2,
  RETREATING: 3,
  DESPERATE: 4,
} as const;
export type AIPhase = (typeof AIPhase)[keyof typeof AIPhase];

export interface BattlefieldAssessment {
  ownStrength: number;
  enemyStrength: number;
  strengthRatio: number;
  ownCenter: { x: number; y: number };
  enemyCenter: { x: number; y: number };
  ownAvgMorale: number;
  enemyAvgMorale: number;
  ownCasualtyPercent: number;
  enemyCasualtyPercent: number;
  flankableEnemies: number[];
  weakEnemies: number[];
  terrainAdvantages: Array<{ tileX: number; tileY: number; defBonus: number }>;
  threatsToGeneral: number[];
  threatsToSupply: number[];
  ownEngagedCount: number;
  ownIdleCount: number;
  ownRoutingCount: number;
  visibleEnemyIds: Set<number>;
  currentTick: number;
}

export interface UnitRoleAssignment {
  unitId: number;
  role: TacticalRole;
  targetX?: number;
  targetY?: number;
}

export interface AIDecision {
  unitId: number;
  orderType: number; // OrderType value
  targetX?: number;
  targetY?: number;
  targetUnitId?: number;
}

export interface PersonalityWeights {
  engagementTick: number;
  decisionInterval: number;
  attackerBias: number;
  defenderBias: number;
  flankerBias: number;
  reserveBias: number;
  aggressiveness: number;
  caution: number;
  flankTendency: number;
  terrainExploitation: number;
  supplyRaidPriority: number;
  pursuitDesire: number;
  ambushTendency: number;
  adaptability: number;
  chargePreference: number;
  pressThreshold: number;
  retreatThreshold: number;
  desperateThreshold: number;
  generalSafeDistance: number;
}
