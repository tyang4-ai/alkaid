import type { OrderType, UnitType, UnitState } from '../../constants';
import type { CampaignSnapshot as CampaignSnapshotType, CampaignSaveSlotMeta as CampaignSaveSlotMetaType } from '../campaign/CampaignTypes';

// Re-export campaign types so consumers can import from SaveTypes
export type CampaignSnapshot = CampaignSnapshotType;
export type CampaignSaveSlotMeta = CampaignSaveSlotMetaType;

// --- Save File Envelope ---

export interface SaveFile {
  version: string;
  timestamp: number;
  type: 'battle' | 'campaign';
  meta: SaveSlotMeta;
  battle?: BattleSnapshot;
  campaign?: CampaignSnapshot;
}

export interface SaveSlotMeta {
  slotId: string;
  name: string;
  timestamp: number;
  tick: number;
  templateId: string;
  playerTroops: number;
  enemyTroops: number;
}

// --- Fog of War Snapshot (Step 13) ---

export interface FogOfWarSnapshot {
  tiles: number[];
}

// --- AI Snapshot (Step 14) ---

export interface AIRoleAssignmentSnapshot {
  unitId: number;
  role: number;
  targetX?: number;
  targetY?: number;
}

export interface AISnapshot {
  personality: number;
  team: number;
  lastDecisionTick: number;
  phase: number;
  initialUnitCount: number;
  rngState: number;
  roleAssignments: AIRoleAssignmentSnapshot[];
}

// --- Battle Snapshot ---

export interface BattleSnapshot {
  terrainSeed: number;
  templateId: string;
  gameState: GameStateSnapshot;
  units: UnitSnapshot[];
  nextUnitId: number;
  orders: OrderSnapshot[];
  supply: SupplySnapshot;
  surrender: SurrenderSnapshot;
  command: CommandSnapshot;
  weather: WeatherSnapshot;
  timeOfDay: TimeOfDaySnapshot;
  environment: EnvironmentStateSnapshot;
  deployment: DeploymentSnapshot;
  retreat: RetreatSnapshot;
  battleEventLogger: BattleEventLoggerSnapshot;
  battleStartTick: number;
  battleEnded: boolean;
  fogOfWar?: FogOfWarSnapshot;
  ai?: AISnapshot;
  aiFogOfWar?: FogOfWarSnapshot;
}

// --- Per-System Snapshots ---

export interface GameStateSnapshot {
  tickNumber: number;
  paused: boolean;
  speedMultiplier: number;
  battleTimeTicks: number;
}

export interface UnitSnapshot {
  id: number;
  type: UnitType;
  team: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  size: number;
  maxSize: number;
  hp: number;
  morale: number;
  fatigue: number;
  supply: number;
  experience: number;
  state: UnitState;
  facing: number;
  path: Array<{ x: number; y: number }> | null;
  pathIndex: number;
  targetX: number;
  targetY: number;
  isGeneral: boolean;
  pendingOrderType: OrderType | null;
  pendingOrderTick: number;
  attackCooldown: number;
  lastAttackTick: number;
  hasCharged: boolean;
  combatTargetId: number;
  combatTicks: number;
  siegeSetupTicks: number;
  formUpTicks: number;
  disengageTicks: number;
  orderModifier: OrderType | null;
  routTicks: number;
  killCount: number;
  holdUnderBombardmentTicks: number;
  desertionFrac: number;
}

export interface OrderSnapshot {
  unitId: number;
  type: OrderType;
  targetX?: number;
  targetY?: number;
  targetUnitId?: number;
}

export interface SupplyTeamSnapshot {
  team: number;
  food: number;
  maxFood: number;
  starvationTicks: number;
}

export interface SupplySnapshot {
  armies: SupplyTeamSnapshot[];
}

export interface SurrenderTeamSnapshot {
  team: number;
  consecutiveHighPressureChecks: number;
  lastPressure: number;
  surrendered: boolean;
  startingSoldiers: number;
}

export interface SurrenderSnapshot {
  teamStates: SurrenderTeamSnapshot[];
}

export interface MessengerSnapshot {
  id: number;
  sourceX: number;
  sourceY: number;
  targetUnitId: number;
  orderType: OrderType;
  x: number;
  y: number;
  delivered: boolean;
  trail: Array<{ x: number; y: number }>;
}

export interface CommandSnapshot {
  messengers: MessengerSnapshot[];
  nextMessengerId: number;
  queue: Array<{
    order: OrderSnapshot;
    sourceX: number;
    sourceY: number;
  }>;
}

export interface WeatherSnapshot {
  currentWeather: number;
  rngState: number;
  ticksSinceLastShift: number;
}

export interface TimeOfDaySnapshot {
  startTime: number;
  lastPhaseChangeTick: number;
}

export interface EnvironmentStateSnapshot {
  weather: number;
  timeOfDay: number;
  windDirection: number;
  visibility: number;
}

export interface DeploymentSnapshot {
  phase: number;
  battleTicks: number;
  reservesSpawned: boolean;
}

export interface RetreatSnapshot {
  retreatingTeams: number[];
  retreatStartTick: Array<{ team: number; tick: number }>;
  lastStalemateCheck: number;
}

export interface BattleEventLoggerSnapshot {
  events: Array<{
    tick: number;
    message: string;
    worldX?: number;
    worldY?: number;
    category: string;
  }>;
  moraleHistory: Array<{ team: number; values: number[] }>;
  supplyHistory: Array<{ team: number; values: number[] }>;
  casualtyHistory: Array<{ team: number; values: number[] }>;
  startTick: number;
  endTick: number;
  sampleInterval: number;
}

// --- Replay Snapshot (Step 14d) ---

export interface ReplaySnapshot {
  version: string;
  terrainSeed: number;
  templateId: string;
  initialUnits: UnitSnapshot[];
  frames: Array<{
    tick: number;
    orders: Array<{
      unitId: number; orderType: number;
      targetX: number; targetY: number;
      targetUnitId?: number; team: number;
    }>;
  }>;
  totalTicks: number;
  environmentInit: EnvironmentStateSnapshot;
  aiPersonality: number;
  aiSeed: number;
}

// --- Game Settings ---

export interface GameSettings {
  speedMultiplier: number;
}

// --- SaveManager Refs ---

export interface SaveSystemRefs {
  gameState: { serialize(): GameStateSnapshot; deserialize(data: GameStateSnapshot): void; getState(): { tickNumber: number } };
  unitManager: { serialize(): { units: UnitSnapshot[]; nextId: number }; deserialize(data: { units: UnitSnapshot[]; nextId: number }): void; getByTeam(team: number): Array<{ size: number; maxSize: number }> };
  orderManager: { serialize(): OrderSnapshot[]; deserialize(data: OrderSnapshot[]): void };
  supplySystem: { serialize(): SupplySnapshot; deserialize(data: SupplySnapshot): void };
  surrenderSystem: { serialize(): SurrenderSnapshot; deserialize(data: SurrenderSnapshot): void };
  commandSystem: { serialize(): CommandSnapshot; deserialize(data: CommandSnapshot): void };
  weatherSystem: { serialize(): WeatherSnapshot; deserialize(data: WeatherSnapshot): void };
  timeOfDaySystem: { serialize(): TimeOfDaySnapshot; deserialize(data: TimeOfDaySnapshot): void };
  deploymentManager: { serialize(): DeploymentSnapshot; deserialize(data: DeploymentSnapshot): void };
  retreatSystem: { serialize(): RetreatSnapshot; deserialize(data: RetreatSnapshot): void };
  battleEventLogger: { serialize(): BattleEventLoggerSnapshot; deserialize(data: BattleEventLoggerSnapshot): void };
  getEnvironmentState: () => EnvironmentStateSnapshot;
  setEnvironmentState: (s: EnvironmentStateSnapshot) => void;
  getBattleStartTick: () => number;
  setBattleStartTick: (t: number) => void;
  getBattleEnded: () => boolean;
  setBattleEnded: (e: boolean) => void;
  getTerrainSeed: () => number;
  getTemplateId: () => string;
  fogOfWar?: { serialize(): FogOfWarSnapshot; deserialize(data: FogOfWarSnapshot): void; reset(): void };
  aiController?: { serialize(): AISnapshot; deserialize(data: AISnapshot): void; reset(): void };
  aiFogOfWar?: { serialize(): FogOfWarSnapshot; deserialize(data: FogOfWarSnapshot): void; reset(): void };
}
