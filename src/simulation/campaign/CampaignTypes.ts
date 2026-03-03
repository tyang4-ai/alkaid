import type { UnitType } from '../../constants';
import type { BattleSnapshot } from '../persistence/SaveTypes';

// --- Campaign Phase (mirrors CampaignPhase const in constants.ts) ---

export type CampaignPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

// --- Territory Types ---

export type TerritoryOwner = 'player' | 'enemy' | 'neutral';

export interface Territory {
  id: string;
  name: string;
  chineseName: string;
  type: number; // CampaignTerritoryType
  adjacentIds: string[];
  mapPosition: { x: number; y: number }; // normalized [0,1] for SVG
  terrainTemplate: string; // MAP_TEMPLATES key for battle
  garrisonStrength: number; // base enemy squad count
  garrisonBaseExp: number; // base enemy experience
  specialBonus?: string;
  owner: TerritoryOwner;
  conqueredTurn: number | null;
}

// --- Resources ---

export interface Resources {
  gold: number;
  population: number;
  horses: number;
  iron: number;
  food: number;
}

// --- Army ---

export interface CampaignSquad {
  squadId: number;
  type: UnitType;
  size: number;
  maxSize: number;
  experience: number;
  morale: number;
  fatigue: number;
  trainingTurnsRemaining: number; // 0 = ready
  isCaptured: boolean;
  capturedEffectiveness: number; // 0.5–1.0
}

export interface ArmyRoster {
  squads: CampaignSquad[];
  generalAlive: boolean;
  generalExperience: number;
  nextSquadId: number;
}

// --- Campaign State ---

export interface CampaignState {
  runId: string;
  seed: number;
  difficulty: 'normal' | 'hard';
  mode: 'ironman' | 'practice';
  territories: Territory[];
  startingTerritoryId: string;
  roster: ArmyRoster;
  resources: Resources;
  turn: number;
  territoriesConquered: number;
  battlesWon: number;
  battlesLost: number;
  totalEnemiesDefeated: number;
  totalSoldiersLost: number;
  bonusObjectivesCompleted: string[];
  phase: CampaignPhase;
  selectedTerritoryId: string | null;
  pendingEvent: { definitionId: string; turn: number } | null;
}

// --- Battle Result (passed from battle back to campaign) ---

export interface BattleResult {
  won: boolean;
  victoryType: number; // VictoryType enum value
  generalAlive: boolean;
  survivingPlayerSquads: Array<{
    squadId: number;
    type: UnitType;
    size: number;
    experience: number;
  }>;
  capturedEnemySquads: Array<{
    type: UnitType;
    size: number;
    experience: number;
  }>;
  totalEnemiesDefeated: number;
  totalPlayerLosses: number;
  battleDurationTicks: number;
  noSquadFullyLost: boolean; // bonus objective
}

// --- Campaign Save ---

export interface CampaignSnapshot {
  campaignState: CampaignState;
  activeBattle?: BattleSnapshot;
  wasLoaded: boolean;
}

export interface CampaignSaveSlotMeta {
  slotId: string;
  name: string;
  timestamp: number;
  turn: number;
  territoriesConquered: number;
  totalTroops: number;
  mode: 'ironman' | 'practice';
}

// --- Unlock System ---

export type UnlockEffectType = 'unit_unlock' | 'stat_bonus' | 'starting_bonus';

export interface UnlockEffect {
  type: UnlockEffectType;
  unitType?: UnitType;
  stat?: string;
  bonus?: string;
  value?: number;
}

export interface UnlockDefinition {
  id: string;
  name: string;
  chineseName: string;
  cost: number;
  description: string;
  effect: UnlockEffect;
  prerequisiteIds: string[];
}

export interface UnlockState {
  totalPointsEarned: number;
  totalPointsSpent: number;
  unlockedIds: string[];
}

// --- Random Events ---

export interface RandomEventChoice {
  label: string;
  chineseLabel: string;
  description: string;
}

export interface RandomEventDefinition {
  id: string;
  name: string;
  chineseName: string;
  description: string;
  choices: RandomEventChoice[];
  condition?: (state: CampaignState) => boolean;
}

// --- Serializable interface ---

export interface Serializable<T> {
  serialize(): T;
  deserialize(data: T): void;
}
