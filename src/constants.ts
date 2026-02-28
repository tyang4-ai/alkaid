// Alkaid (破军) — Game Constants
// ALL game balance numbers, timing, and configuration.
// Must match Python training environment (Phase 4).

// --- Simulation Timing ---
export const SIM_TICK_RATE = 20;
export const SIM_TICK_INTERVAL_MS = 1000 / SIM_TICK_RATE; // 50ms
export const MAX_FRAME_DELTA_MS = 250; // Spiral-of-death clamp (max 5 ticks/frame)

// --- Map Defaults (Step 2) ---
export const DEFAULT_MAP_WIDTH = 200;
export const DEFAULT_MAP_HEIGHT = 150;
export const TILE_SIZE = 16;

// --- Canvas ---
export const CANVAS_BG_COLOR = 0x1a1a2e;

// --- Terrain Types ---
export const TerrainType = {
  WATER: 0,
  FORD: 1,
  PLAINS: 2,
  FOREST: 3,
  HILLS: 4,
  MOUNTAINS: 5,
  RIVER: 6,
  MARSH: 7,
  ROAD: 8,
  CITY: 9,
} as const;
export type TerrainType = (typeof TerrainType)[keyof typeof TerrainType];

// --- Terrain Stats (from ref-unit-stats.md) ---
export interface TerrainStats {
  moveCost: number;    // Multiplier (1.0 = normal). -1 = impassable.
  defBonus: number;    // Additive defense bonus (e.g., 0.25 = +25%)
  cavEffect: number;   // Cavalry effectiveness multiplier (1.0 = full)
  forageRate: number;  // Food gathered per tick per squad foraging here
}

export const TERRAIN_STATS: Record<TerrainType, TerrainStats> = {
  [TerrainType.WATER]:     { moveCost: -1,  defBonus: 0.00, cavEffect: 0.00, forageRate: 0.0 },
  [TerrainType.FORD]:      { moveCost: 2.5, defBonus: -0.20, cavEffect: 0.30, forageRate: 0.0 },
  [TerrainType.PLAINS]:    { moveCost: 1.0, defBonus: 0.00, cavEffect: 1.00, forageRate: 1.0 },
  [TerrainType.FOREST]:    { moveCost: 1.8, defBonus: 0.25, cavEffect: 0.25, forageRate: 1.5 },
  [TerrainType.HILLS]:     { moveCost: 2.0, defBonus: 0.40, cavEffect: 0.50, forageRate: 0.5 },
  [TerrainType.MOUNTAINS]: { moveCost: 3.0, defBonus: 0.50, cavEffect: 0.10, forageRate: 0.2 },
  [TerrainType.RIVER]:     { moveCost: -1,  defBonus: 0.30, cavEffect: 0.00, forageRate: 1.2 },
  [TerrainType.MARSH]:     { moveCost: 3.0, defBonus: -0.10, cavEffect: 0.10, forageRate: 0.3 },
  [TerrainType.ROAD]:      { moveCost: 0.5, defBonus: 0.00, cavEffect: 1.00, forageRate: 0.0 },
  [TerrainType.CITY]:      { moveCost: 0.5, defBonus: 1.50, cavEffect: 0.00, forageRate: 0.0 },
};

// --- Terrain Colors (ancient Chinese map aesthetic) ---
export const TERRAIN_COLORS: Record<TerrainType, number> = {
  [TerrainType.WATER]:     0x3A5A7A,  // Deep ink blue
  [TerrainType.FORD]:      0x7A9BB5,  // Lighter blue-grey
  [TerrainType.PLAINS]:    0xC4B07B,  // Warm tan (parchment)
  [TerrainType.FOREST]:    0x5B7A47,  // Muted olive green
  [TerrainType.HILLS]:     0x9E8C6C,  // Earth brown
  [TerrainType.MOUNTAINS]: 0x6B5B4F,  // Dark rocky brown
  [TerrainType.RIVER]:     0x4A6B8A,  // Ink blue-grey
  [TerrainType.MARSH]:     0x6B7B5A,  // Murky olive
  [TerrainType.ROAD]:      0xA89070,  // Packed earth
  [TerrainType.CITY]:      0x8B7355,  // Warm timber brown
};

// --- Terrain Generation Parameters ---
export const TERRAIN_GEN = {
  OCTAVES: 6,
  LACUNARITY: 2.0,
  PERSISTENCE: 0.5,
  BASE_FREQUENCY: 0.005,
  ELEVATION_POWER: 1.5,
  MOISTURE_SEED_OFFSET: 10000,
  RIVER_COUNT_MIN: 2,
  RIVER_COUNT_MAX: 5,
  RIVER_EROSION: 0.98,
  // Biome thresholds
  WATER_LEVEL: 0.15,
  FORD_LEVEL: 0.20,
  MOUNTAIN_LEVEL: 0.80,
  HILLS_LEVEL: 0.60,
  FOREST_MOISTURE: 0.66,
  PLAINS_MOISTURE: 0.33,
};

// --- Contour Line Parameters ---
export const CONTOUR = {
  MINOR_INTERVAL: 0.1,    // Every 0.1 elevation
  MAJOR_EVERY: 3,         // Every 3rd minor = major contour (0.3 elevation)
  MINOR_COLOR: 0x2A1F14,
  MINOR_ALPHA: 0.15,
  MAJOR_COLOR: 0x1A0F08,
  MAJOR_ALPHA: 0.30,
  LINE_WIDTH_MINOR: 1,
  LINE_WIDTH_MAJOR: 1.5,
};

// --- Camera (Step 3) ---
export const CAMERA_ZOOM_MIN = 0.25;
export const CAMERA_ZOOM_MAX = 3.0;
export const CAMERA_ZOOM_SPEED = 0.15;
export const CAMERA_PAN_SPEED = 400;
export const CAMERA_EDGE_SCROLL_ZONE = 20;
export const CAMERA_LERP_FACTOR = 0.15;
export const CAMERA_DRAG_DEAD_ZONE = 5; // px — left-click drag vs click threshold

// --- Unit Types (Step 4) ---
export const UnitType = {
  // Land (0-9)
  JI_HALBERDIERS: 0,
  DAO_SWORDSMEN: 1,
  NU_CROSSBOWMEN: 2,
  GONG_ARCHERS: 3,
  LIGHT_CAVALRY: 4,
  HEAVY_CAVALRY: 5,
  HORSE_ARCHERS: 6,
  SIEGE_ENGINEERS: 7,
  ELITE_GUARD: 8,
  SCOUTS: 9,
  // Naval (10-12)
  MENG_CHONG: 10,
  LOU_CHUAN: 11,
  FIRE_SHIPS: 12,
  // Special (13)
  GENERAL: 13,
} as const;
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const UnitCategory = {
  INFANTRY: 0,
  RANGED: 1,
  CAVALRY: 2,
  SIEGE: 3,
  NAVAL: 4,
} as const;
export type UnitCategory = (typeof UnitCategory)[keyof typeof UnitCategory];

export const UnitState = {
  IDLE: 0,
  MOVING: 1,
  ATTACKING: 2,
  DEFENDING: 3,
  ROUTING: 4,
  DEAD: 5,
} as const;
export type UnitState = (typeof UnitState)[keyof typeof UnitState];

// --- Unit Type Configuration ---
export interface UnitTypeConfig {
  type: UnitType;
  displayName: string;
  chineseName: string;
  category: UnitCategory;
  maxSize: number;
  hpPerSoldier: number;
  damage: number;
  attackSpeed: number;   // hits or volleys per sec
  range: number;         // tiles
  armor: number;
  armorPen: number;
  speed: number;         // tiles/sec
  cost: number;          // gold
}

export const UNIT_TYPE_CONFIGS: Record<UnitType, UnitTypeConfig> = {
  [UnitType.JI_HALBERDIERS]: {
    type: UnitType.JI_HALBERDIERS, displayName: 'Ji Halberdiers', chineseName: '戟兵',
    category: UnitCategory.INFANTRY, maxSize: 120, hpPerSoldier: 100,
    damage: 8, attackSpeed: 1.0, range: 1, armor: 6, armorPen: 0, speed: 1.0, cost: 80,
  },
  [UnitType.DAO_SWORDSMEN]: {
    type: UnitType.DAO_SWORDSMEN, displayName: 'Dao Swordsmen', chineseName: '刀兵',
    category: UnitCategory.INFANTRY, maxSize: 80, hpPerSoldier: 90,
    damage: 12, attackSpeed: 1.2, range: 1, armor: 4, armorPen: 0, speed: 1.2, cost: 100,
  },
  [UnitType.NU_CROSSBOWMEN]: {
    type: UnitType.NU_CROSSBOWMEN, displayName: 'Nu Crossbowmen', chineseName: '弩兵',
    category: UnitCategory.RANGED, maxSize: 100, hpPerSoldier: 70,
    damage: 15, attackSpeed: 0.33, range: 8, armor: 2, armorPen: 3, speed: 0.8, cost: 90,
  },
  [UnitType.GONG_ARCHERS]: {
    type: UnitType.GONG_ARCHERS, displayName: 'Gong Archers', chineseName: '弓兵',
    category: UnitCategory.RANGED, maxSize: 80, hpPerSoldier: 65,
    damage: 9, attackSpeed: 0.8, range: 6, armor: 1, armorPen: 1, speed: 1.1, cost: 120,
  },
  [UnitType.LIGHT_CAVALRY]: {
    type: UnitType.LIGHT_CAVALRY, displayName: 'Light Cavalry', chineseName: '轻骑',
    category: UnitCategory.CAVALRY, maxSize: 40, hpPerSoldier: 85,
    damage: 10, attackSpeed: 0.9, range: 1, armor: 3, armorPen: 0, speed: 2.5, cost: 200,
  },
  [UnitType.HEAVY_CAVALRY]: {
    type: UnitType.HEAVY_CAVALRY, displayName: 'Heavy Cavalry', chineseName: '重骑',
    category: UnitCategory.CAVALRY, maxSize: 25, hpPerSoldier: 110,
    damage: 18, attackSpeed: 0.7, range: 1, armor: 8, armorPen: 0, speed: 2.0, cost: 350,
  },
  [UnitType.HORSE_ARCHERS]: {
    type: UnitType.HORSE_ARCHERS, displayName: 'Horse Archers', chineseName: '骑射',
    category: UnitCategory.CAVALRY, maxSize: 30, hpPerSoldier: 75,
    damage: 7, attackSpeed: 0.6, range: 5, armor: 2, armorPen: 0, speed: 2.3, cost: 280,
  },
  [UnitType.SIEGE_ENGINEERS]: {
    type: UnitType.SIEGE_ENGINEERS, displayName: 'Siege Engineers', chineseName: '攻城兵',
    category: UnitCategory.SIEGE, maxSize: 30, hpPerSoldier: 60,
    damage: 25, attackSpeed: 0.1, range: 10, armor: 0, armorPen: 0, speed: 0.4, cost: 500,
  },
  [UnitType.ELITE_GUARD]: {
    type: UnitType.ELITE_GUARD, displayName: 'Elite Guard', chineseName: '亲卫',
    category: UnitCategory.INFANTRY, maxSize: 30, hpPerSoldier: 130,
    damage: 16, attackSpeed: 1.1, range: 1, armor: 7, armorPen: 0, speed: 1.3, cost: 400,
  },
  [UnitType.SCOUTS]: {
    type: UnitType.SCOUTS, displayName: 'Scouts', chineseName: '斥候',
    category: UnitCategory.INFANTRY, maxSize: 20, hpPerSoldier: 50,
    damage: 5, attackSpeed: 1.0, range: 1, armor: 1, armorPen: 0, speed: 2.0, cost: 60,
  },
  [UnitType.MENG_CHONG]: {
    type: UnitType.MENG_CHONG, displayName: 'Meng Chong', chineseName: '蒙冲',
    category: UnitCategory.NAVAL, maxSize: 40, hpPerSoldier: 80,
    damage: 14, attackSpeed: 0.8, range: 1, armor: 5, armorPen: 0, speed: 1.8, cost: 250,
  },
  [UnitType.LOU_CHUAN]: {
    type: UnitType.LOU_CHUAN, displayName: 'Lou Chuan', chineseName: '楼船',
    category: UnitCategory.NAVAL, maxSize: 100, hpPerSoldier: 70,
    damage: 12, attackSpeed: 0.5, range: 6, armor: 4, armorPen: 0, speed: 0.8, cost: 450,
  },
  [UnitType.FIRE_SHIPS]: {
    type: UnitType.FIRE_SHIPS, displayName: 'Fire Ships', chineseName: '火船',
    category: UnitCategory.NAVAL, maxSize: 10, hpPerSoldier: 40,
    damage: 200, attackSpeed: 0, range: 0, armor: 0, armorPen: 0, speed: 2.2, cost: 150,
  },
  [UnitType.GENERAL]: {
    type: UnitType.GENERAL, displayName: 'General', chineseName: '将军',
    category: UnitCategory.INFANTRY, maxSize: 1, hpPerSoldier: 200,
    damage: 5, attackSpeed: 1.0, range: 1, armor: 10, armorPen: 0, speed: 1.5, cost: 0,
  },
};

// --- Type Matchup Table (land units 0-9 only) ---
// Rows = attacker UnitType, Cols = defender UnitType
// prettier-ignore
export const TYPE_MATCHUP_TABLE: number[][] = [
  /* Halberd  */ [1.0, 0.8, 1.0, 1.0, 1.5, 1.5, 1.5, 1.0, 0.8, 1.2],
  /* Sword    */ [1.2, 1.0, 1.3, 1.3, 0.7, 0.6, 0.7, 1.5, 0.9, 1.5],
  /* Xbow     */ [1.2, 1.0, 1.0, 1.0, 0.8, 0.7, 0.8, 1.0, 1.0, 1.0],
  /* Archer   */ [1.0, 0.9, 1.0, 1.0, 1.0, 0.6, 1.0, 1.2, 0.8, 1.2],
  /* L.Cav    */ [0.6, 1.1, 1.5, 1.5, 1.0, 0.7, 1.0, 2.0, 0.8, 1.5],
  /* H.Cav    */ [0.5, 1.3, 1.8, 1.8, 1.3, 1.0, 1.2, 2.5, 1.0, 2.0],
  /* H.Archer */ [0.7, 0.8, 0.9, 0.9, 1.1, 0.8, 1.0, 1.3, 0.7, 1.0],
  /* Siege    */ [0.5, 0.5, 0.5, 0.5, 0.3, 0.3, 0.3, 1.0, 0.5, 0.5],
  /* Elite    */ [1.2, 1.1, 1.2, 1.2, 1.3, 1.2, 1.2, 1.5, 1.0, 1.5],
  /* Scout    */ [0.5, 0.4, 0.5, 0.5, 0.4, 0.3, 0.4, 0.8, 0.3, 1.0],
];

// --- Unit Rendering (Step 4) ---
export const UNIT_BASE_DOT_RADIUS = 6;   // px at full strength
export const UNIT_MIN_DOT_RADIUS = 2;    // minimum visible

export const TEAM_COLORS = {
  PLAYER: 0x4A90D9,   // Muted blue
  ENEMY: 0xC75050,    // Muted red
  NEUTRAL: 0x888888,
} as const;

export const UNIT_SHAPE = {
  CIRCLE: 0,    // Infantry
  TRIANGLE: 1,  // Cavalry
  DIAMOND: 2,   // Ranged
  SQUARE: 3,    // Siege
  HEXAGON: 4,   // Naval
} as const;

export const UNIT_TYPE_SHAPE: Record<UnitType, number> = {
  [UnitType.JI_HALBERDIERS]: UNIT_SHAPE.CIRCLE,
  [UnitType.DAO_SWORDSMEN]: UNIT_SHAPE.CIRCLE,
  [UnitType.NU_CROSSBOWMEN]: UNIT_SHAPE.DIAMOND,
  [UnitType.GONG_ARCHERS]: UNIT_SHAPE.DIAMOND,
  [UnitType.LIGHT_CAVALRY]: UNIT_SHAPE.TRIANGLE,
  [UnitType.HEAVY_CAVALRY]: UNIT_SHAPE.TRIANGLE,
  [UnitType.HORSE_ARCHERS]: UNIT_SHAPE.TRIANGLE,
  [UnitType.SIEGE_ENGINEERS]: UNIT_SHAPE.SQUARE,
  [UnitType.ELITE_GUARD]: UNIT_SHAPE.CIRCLE,
  [UnitType.SCOUTS]: UNIT_SHAPE.CIRCLE,
  [UnitType.MENG_CHONG]: UNIT_SHAPE.HEXAGON,
  [UnitType.LOU_CHUAN]: UNIT_SHAPE.HEXAGON,
  [UnitType.FIRE_SHIPS]: UNIT_SHAPE.HEXAGON,
  [UnitType.GENERAL]: UNIT_SHAPE.CIRCLE,
};

// --- Selection (Step 5) ---
export const SELECTION_CLICK_RADIUS = 12;
export const SELECTION_RING_RADIUS_PAD = 4;
export const SELECTION_RING_COLOR = 0xFFD700;
export const SELECTION_RING_WIDTH = 1.5;
export const SELECTION_RING_PULSE_SPEED = 3.0;
export const SELECTION_RING_ALPHA_MIN = 0.4;
export const SELECTION_RING_ALPHA_MAX = 1.0;
export const SELECTION_BOX_FILL_COLOR = 0xFFFFFF;
export const SELECTION_BOX_FILL_ALPHA = 0.1;
export const SELECTION_BOX_STROKE_COLOR = 0xFFD700;
export const SELECTION_BOX_STROKE_ALPHA = 0.6;

// --- Orders (Step 5) ---
export const OrderType = {
  MOVE: 0,
  ATTACK: 1,
  HOLD: 2,
  RETREAT: 3,
  FLANK: 4,
  CHARGE: 5,
  FORM_UP: 6,
  DISENGAGE: 7,
  RALLY: 8,
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const ORDER_DISPLAY: Record<OrderType, { label: string; chinese: string; color: number }> = {
  [OrderType.MOVE]:       { label: 'Move',       chinese: '移动', color: 0xFFFFFF },
  [OrderType.ATTACK]:     { label: 'Attack',     chinese: '攻击', color: 0xCC3333 },
  [OrderType.HOLD]:       { label: 'Hold',       chinese: '驻守', color: 0x33AA33 },
  [OrderType.RETREAT]:    { label: 'Retreat',     chinese: '撤退', color: 0xAAAA33 },
  [OrderType.FLANK]:      { label: 'Flank',      chinese: '侧击', color: 0xCC8833 },
  [OrderType.CHARGE]:     { label: 'Charge',     chinese: '冲锋', color: 0xDD4444 },
  [OrderType.FORM_UP]:    { label: 'Form Up',    chinese: '列阵', color: 0x4488CC },
  [OrderType.DISENGAGE]:  { label: 'Disengage',  chinese: '脱离', color: 0x888888 },
  [OrderType.RALLY]:      { label: 'Rally',      chinese: '集结', color: 0x44CC44 },
};

export const ORDER_LINE_DASH = 4;
export const ORDER_LINE_GAP = 4;
export const ORDER_LINE_WIDTH = 1.5;
export const ORDER_LINE_ALPHA = 0.6;
export const ORDER_FLAG_SIZE = 6;

export const RADIAL_MENU_RADIUS = 110;
export const RADIAL_MENU_INNER_RADIUS = 40;
export const RADIAL_MENU_WEDGE_COLOR = 0x1A1A2E;
export const RADIAL_MENU_HOVER_COLOR = 0x2A2A4E;
export const RADIAL_MENU_BORDER_COLOR = 0x555555;
export const RADIAL_MENU_FONT_SIZE = 12;

// --- Deployment Phase (Step 5b) ---
export const DeploymentPhase = {
  INACTIVE: 0,
  DEPLOYING: 1,
  COUNTDOWN: 2,
  BATTLE: 3,
  POST_BATTLE: 4,
} as const;
export type DeploymentPhase = (typeof DeploymentPhase)[keyof typeof DeploymentPhase];

export const FormationType = {
  STANDARD_LINE: 0,
  CRESCENT: 1,
  ECHELON_LEFT: 2,
  ECHELON_RIGHT: 3,
  DEFENSIVE_SQUARE: 4,
  AMBUSH: 5,
} as const;
export type FormationType = (typeof FormationType)[keyof typeof FormationType];

export const FORMATION_DISPLAY: Record<FormationType, { label: string; chinese: string }> = {
  [FormationType.STANDARD_LINE]:    { label: 'Standard Line',    chinese: '默认阵型' },
  [FormationType.CRESCENT]:         { label: 'Crescent',         chinese: '月牙阵' },
  [FormationType.ECHELON_LEFT]:     { label: 'Echelon Left',     chinese: '斜行阵(左)' },
  [FormationType.ECHELON_RIGHT]:    { label: 'Echelon Right',    chinese: '斜行阵(右)' },
  [FormationType.DEFENSIVE_SQUARE]: { label: 'Defensive Square', chinese: '方阵' },
  [FormationType.AMBUSH]:           { label: 'Ambush',           chinese: '伏兵阵' },
};

// Deployment zone rendering — ink-wash / parchment map aesthetic
export const DEPLOYMENT_ZONE_FRACTION = 0.25;
export const DEPLOYMENT_ZONE_COLOR = 0xC9A84C;         // Warm gold ink wash (marked territory)
export const DEPLOYMENT_ZONE_ALPHA = 0.22;
export const DEPLOYMENT_ZONE_BORDER_COLOR = 0x8B6914;  // Dark aged-gold ink border
export const DEPLOYMENT_ZONE_BORDER_ALPHA = 0.50;
export const DEPLOYMENT_ZONE_BORDER_WIDTH = 1.5;
export const DEPLOYMENT_GHOST_ALPHA = 0.55;
export const DEPLOYMENT_GHOST_VALID_COLOR = 0x5B8C5A;  // Muted jade green
export const DEPLOYMENT_GHOST_INVALID_COLOR = 0xA23B2C; // Cinnabar/vermillion red
export const DEPLOYMENT_COMMAND_RADIUS_FRACTION = 0.30;
export const DEPLOYMENT_COMMAND_RADIUS_COLOR = 0xC9A84C; // Warm gold, matches zone
export const DEPLOYMENT_COMMAND_RADIUS_ALPHA = 0.12;
export const DEPLOYMENT_RESERVE_DELAY_TICKS = 60;
export const DEPLOYMENT_COUNTDOWN_SECONDS = 3;

// Sidebar rendering — lacquered wood + parchment scroll
export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_BG_COLOR = 0x1C1410;              // Deep lacquered rosewood
export const SIDEBAR_BG_ALPHA = 0.94;
export const SIDEBAR_ITEM_HEIGHT = 48;
export const SIDEBAR_PADDING = 12;
export const SIDEBAR_FONT_COLOR = 0xD4C4A0;            // Aged parchment ivory
export const SIDEBAR_HIGHLIGHT_COLOR = 0x2A1F14;       // Dark wood grain stripe
export const SIDEBAR_BUTTON_COLOR = 0x8B2500;          // Cinnabar red (vermillion seal)
export const SIDEBAR_BUTTON_HOVER_COLOR = 0xA23B2C;    // Lighter cinnabar on hover

// --- Pathfinding (Step 6) ---
export const SPATIAL_HASH_CELL_SIZE = 64;  // px (~4 tiles)
export const PATH_MAX_COMPUTATIONS_PER_TICK = 5;  // A* paths budgeted per sim tick
export const PATH_CACHE_TTL_TICKS = 40;  // 2 seconds at 20Hz
export const PATH_MAX_LENGTH = 5000;  // max nodes explored in a single A* search
export const FLOW_FIELD_GROUP_THRESHOLD = 6;  // use flow field when 6+ units target same area
export const FLOW_FIELD_TARGET_SNAP = 3;  // tiles — targets within this range share a flow field
export const PATH_DIAGONAL_COST = 1.414;  // sqrt(2) for octile movement
export const PATH_ARRIVAL_THRESHOLD = 4;  // pixels — unit "arrived" when this close to waypoint
export const PATH_RECALC_DISTANCE = 48;  // pixels — recalc path if target moved more than this

// Unit-specific terrain cost overrides (from ref-unit-stats.md)
// Maps UnitType -> TerrainType -> moveCost override. Absent entries use TERRAIN_STATS default.
export const UNIT_TERRAIN_COST_OVERRIDES: Partial<Record<UnitType, Partial<Record<TerrainType, number>>>> = {
  // Dao Swordsmen: no penalty in forest or hills
  [UnitType.DAO_SWORDSMEN]: {
    [TerrainType.FOREST]: 1.0,
    [TerrainType.HILLS]: 1.0,
  },
  // Light Cavalry: Forest=4.0, Hills=2.0, Mountains/Marsh impassable
  [UnitType.LIGHT_CAVALRY]: {
    [TerrainType.FOREST]: 4.0,
    [TerrainType.HILLS]: 2.0,
    [TerrainType.MOUNTAINS]: -1,
    [TerrainType.MARSH]: -1,
  },
  // Heavy Cavalry: even worse in rough terrain
  [UnitType.HEAVY_CAVALRY]: {
    [TerrainType.FOREST]: 6.0,
    [TerrainType.HILLS]: 2.5,
    [TerrainType.MOUNTAINS]: -1,
    [TerrainType.MARSH]: -1,
  },
  // Horse Archers: Hills=2.5, Forest/Mountains/Marsh impassable
  [UnitType.HORSE_ARCHERS]: {
    [TerrainType.FOREST]: -1,
    [TerrainType.HILLS]: 2.5,
    [TerrainType.MOUNTAINS]: -1,
    [TerrainType.MARSH]: -1,
  },
  // Scouts: no penalty except mountains (1.5x instead of 3.0x)
  [UnitType.SCOUTS]: {
    [TerrainType.FOREST]: 1.0,
    [TerrainType.HILLS]: 1.0,
    [TerrainType.MARSH]: 1.0,
    [TerrainType.MOUNTAINS]: 1.5,
  },
  // Naval units: ONLY on water/river, everything else impassable
  [UnitType.MENG_CHONG]: {
    [TerrainType.WATER]: 1.0, [TerrainType.RIVER]: 1.0,
    [TerrainType.PLAINS]: -1, [TerrainType.FOREST]: -1, [TerrainType.HILLS]: -1,
    [TerrainType.MOUNTAINS]: -1, [TerrainType.MARSH]: -1, [TerrainType.ROAD]: -1,
    [TerrainType.CITY]: -1, [TerrainType.FORD]: -1,
  },
  [UnitType.LOU_CHUAN]: {
    [TerrainType.WATER]: 1.0, [TerrainType.RIVER]: 1.0,
    [TerrainType.PLAINS]: -1, [TerrainType.FOREST]: -1, [TerrainType.HILLS]: -1,
    [TerrainType.MOUNTAINS]: -1, [TerrainType.MARSH]: -1, [TerrainType.ROAD]: -1,
    [TerrainType.CITY]: -1, [TerrainType.FORD]: -1,
  },
  [UnitType.FIRE_SHIPS]: {
    [TerrainType.WATER]: 1.0, [TerrainType.RIVER]: 1.0,
    [TerrainType.PLAINS]: -1, [TerrainType.FOREST]: -1, [TerrainType.HILLS]: -1,
    [TerrainType.MOUNTAINS]: -1, [TerrainType.MARSH]: -1, [TerrainType.ROAD]: -1,
    [TerrainType.CITY]: -1, [TerrainType.FORD]: -1,
  },
};

/** Get effective move cost for a unit type on a terrain type. Returns -1 if impassable. */
export function getMoveCost(unitType: UnitType, terrainType: TerrainType): number {
  const overrides = UNIT_TERRAIN_COST_OVERRIDES[unitType];
  if (overrides && terrainType in overrides) {
    return overrides[terrainType]!;
  }
  return TERRAIN_STATS[terrainType].moveCost;
}

/** Get type matchup multiplier. Handles land units (0-9) from table, General (13) defaults. */
export function getTypeMatchup(attacker: UnitType, defender: UnitType): number {
  // General attacking: weak (0.5), General defending: neutral (1.0)
  if (attacker === UnitType.GENERAL) return 0.5;
  if (defender === UnitType.GENERAL) return 1.0;
  // Naval/out-of-range: default 1.0
  if (attacker > 9 || defender > 9) return 1.0;
  return TYPE_MATCHUP_TABLE[attacker][defender];
}

/** Check if a unit type is ranged (fires projectiles). */
export function isRangedUnit(unitType: UnitType): boolean {
  return unitType === UnitType.NU_CROSSBOWMEN
    || unitType === UnitType.GONG_ARCHERS
    || unitType === UnitType.HORSE_ARCHERS
    || unitType === UnitType.SIEGE_ENGINEERS;
}

/** Check if a unit type can fire while moving. */
export function canFireWhileMoving(unitType: UnitType): boolean {
  return unitType === UnitType.HORSE_ARCHERS || unitType === UnitType.GONG_ARCHERS;
}

// --- Command System (Step 7) ---
export const COMMAND_RADIUS_FRACTION = 0.30;       // 30% of map width
export const MESSENGER_SPEED = 4.0;                // tiles/sec base
export const MESSENGER_SPEED_IN_RADIUS = 12.0;     // tiles/sec within command radius
export const MESSENGER_RETREAT_SPEED_BONUS = 1.5;   // multiplier for retreat orders
export const MESSENGER_RALLY_DELAY_MULTIPLIER = 2.0; // rally messengers move at half speed
export const GENERAL_DEAD_MESSENGER_SPEED_MULT = 0.5;
export const GENERAL_DEAD_MISINTERPRET_CHANCE = 0.15;
export const RALLY_MORALE_THRESHOLD_OFFSET = 15;
export const MESSENGER_TRAIL_INTERVAL_TICKS = 2;    // push trail pos every N ticks

// --- Combat System (Step 8) ---
export const MELEE_RANGE_TILES = 1;
export const COMBAT_DETECT_INTERVAL_TICKS = 2;
export const CAVALRY_CHARGE_BONUS_LIGHT = 2.0;
export const CAVALRY_CHARGE_BONUS_HEAVY = 2.5;
export const CAVALRY_CHARGE_MORALE_SHOCK = -8;
export const SIEGE_AREA_RADIUS_TILES = 2;
export const SIEGE_SETUP_TICKS = 100;
export const DAO_SHIELD_ARROW_REDUCTION = 0.30;
export const CROSSBOW_VOLLEY_RANKS = 3;
export const FIRE_WHILE_MOVING_PENALTY = 0.30;
export const COMBINE_THRESHOLD = 0.70;
export const SPLIT_MORALE_PENALTY = 10;
export const COMBAT_DISENGAGE_RANGE_MULT = 1.2;    // disengage if target moves beyond range*this
export const MORALE_LOSS_PER_CASUALTY_PERCENT = -2;
export const ROUT_CASCADE_RADIUS_TILES = 5;
export const ROUT_CASCADE_MORALE_HIT = -10;
export const ROUT_SPEED_MULTIPLIER = 1.5;
export const ROUT_DAMAGE_TAKEN_MULT = 1.5;
export const ROUT_NO_ORDERS_TICKS = 30;
export const GENERAL_NEARBY_MORALE_PER_TICK = 1.0;

// --- Order Effects (Steps 7-8) ---
export const HOLD_DEFENSE_BONUS = 0.10;
export const CHARGE_SPEED_MULT = 1.30;
export const CHARGE_FATIGUE_PER_TICK = 2;
export const FORM_UP_ARMOR_BONUS = 0.20;
export const FORM_UP_SPEED_PENALTY = 0.30;
export const FORM_UP_COMPLETION_TICKS = 3;
export const DISENGAGE_SPEED_PENALTY = 0.20;
export const DISENGAGE_PENALTY_TICKS = 5;

// --- Weather System (Step 9b) ---
export const WeatherType = { CLEAR: 0, RAIN: 1, FOG: 2, WIND: 3, SNOW: 4 } as const;
export type WeatherType = (typeof WeatherType)[keyof typeof WeatherType];

export const WEATHER_MODIFIERS = {
  [WeatherType.CLEAR]:  { rangedMult: 1.0, crossbowMult: 1.0, movementMult: 1.0, siegeAccuracyMult: 1.0, visibilityMult: 1.0, fireMult: 1.0, fordDangerMult: 1.0, ambushMoraleMult: 1.0 },
  [WeatherType.RAIN]:   { rangedMult: 0.80, crossbowMult: 0.60, movementMult: 0.80, siegeAccuracyMult: 0.70, visibilityMult: 0.80, fireMult: 0.50, fordDangerMult: 1.50, ambushMoraleMult: 1.0 },
  [WeatherType.FOG]:    { rangedMult: 0.80, crossbowMult: 0.80, movementMult: 1.0, siegeAccuracyMult: 1.0, visibilityMult: 0.50, fireMult: 1.0, fordDangerMult: 1.0, ambushMoraleMult: 2.0 },
  [WeatherType.WIND]:   { rangedMult: 1.0, crossbowMult: 1.0, movementMult: 1.0, siegeAccuracyMult: 1.0, visibilityMult: 1.0, fireMult: 1.0, fordDangerMult: 1.0, ambushMoraleMult: 1.0 },
  [WeatherType.SNOW]:   { rangedMult: 1.0, crossbowMult: 1.0, movementMult: 0.85, siegeAccuracyMult: 1.0, visibilityMult: 0.70, fireMult: 1.0, fordDangerMult: 0.0, ambushMoraleMult: 1.0 },
};
export const WIND_ACCURACY_BONUS = 0.10;
export const WIND_RANGE_BONUS = 1;
export const SNOW_FATIGUE_MULT = 1.50;
export const SNOW_SOUTHERN_MORALE_PENALTY = -10;
export const SNOW_ICE_BREAK_CHANCE = 0.10;
export const SNOW_ICE_BREAK_CASUALTIES = 0.30;

export const WEATHER_SHIFT_INTERVAL_TICKS = 200;
export const WEATHER_SHIFT_CHANCE = 0.20;
export const WEATHER_PROBABILITIES = [0.40, 0.20, 0.15, 0.15, 0.10];

// --- Time of Day (Step 9b) ---
export const TimeOfDay = { DAWN: 0, MORNING: 1, MIDDAY: 2, AFTERNOON: 3, DUSK: 4, NIGHT: 5 } as const;
export type TimeOfDay = (typeof TimeOfDay)[keyof typeof TimeOfDay];
export const TIME_PHASE_DURATION_TICKS = 200;

export const TIME_OF_DAY_MODIFIERS = {
  [TimeOfDay.DAWN]:      { visibilityMult: 0.80, moraleMod: 0, fatigueMult: 1.0, supplyMult: 1.0, rangedAccuracyMult: 1.0, attackerMoraleBonus: 10, fogChanceBonus: 0.20 },
  [TimeOfDay.MORNING]:   { visibilityMult: 1.00, moraleMod: 0, fatigueMult: 1.0, supplyMult: 1.0, rangedAccuracyMult: 1.0, attackerMoraleBonus: 0, fogChanceBonus: 0 },
  [TimeOfDay.MIDDAY]:    { visibilityMult: 1.00, moraleMod: 0, fatigueMult: 1.20, supplyMult: 1.30, rangedAccuracyMult: 1.0, attackerMoraleBonus: 0, fogChanceBonus: 0 },
  [TimeOfDay.AFTERNOON]: { visibilityMult: 1.00, moraleMod: -5, fatigueMult: 1.10, supplyMult: 1.0, rangedAccuracyMult: 1.0, attackerMoraleBonus: 0, fogChanceBonus: 0 },
  [TimeOfDay.DUSK]:      { visibilityMult: 0.60, moraleMod: 0, fatigueMult: 1.15, supplyMult: 1.0, rangedAccuracyMult: 0.85, attackerMoraleBonus: 0, fogChanceBonus: 0, defenderMoraleBonus: 5 },
  [TimeOfDay.NIGHT]:     { visibilityMult: 0.30, moraleMod: -10, fatigueMult: 1.05, supplyMult: 1.0, rangedAccuracyMult: 0.80, attackerMoraleBonus: 0, fogChanceBonus: 0 },
};
export const NIGHT_VETERAN_EXP_THRESHOLD = 60;
export const NIGHT_FRIENDLY_FIRE_CHANCE = 0.05;
export const NIGHT_FIRE_MORALE_MULT = 1.30;

// --- Fatigue (Step 9a) ---
export const FATIGUE_MARCH_PER_TICK = 1;
export const FATIGUE_FIGHTING_PER_TICK = 3;
export const FATIGUE_FORD_PER_TICK = 5;
export const FATIGUE_MOUNTAIN_PER_TICK = 2;
export const FATIGUE_SIEGE_CARRY_PER_TICK = 2;
export const FATIGUE_RECOVERY_STATIONARY = -2;
export const FATIGUE_RECOVERY_WELL_FED_BONUS = -0.5;
/** [fatigueThreshold, speedMultiplier] — first match where fatigue >= threshold wins. */
export const FATIGUE_SPEED_THRESHOLDS: [number, number][] = [
  [100, 0.30], [80, 0.50], [60, 0.70], [30, 0.85], [0, 1.00],
];
export const FATIGUE_MORALE_THRESHOLD = 80;
export const FATIGUE_MORALE_PENALTY_PER_TICK = -1;

// --- Supply (Step 9a) ---
export const SUPPLY_BASE_CAPACITY = 6000;
export const SUPPLY_CONSUMPTION_PER_SOLDIER_PER_TICK = 0.01;
export const SUPPLY_LOW_RATIONS_THRESHOLD = 0.50;
export const SUPPLY_HUNGER_THRESHOLD = 0.25;
export const SUPPLY_COLLAPSE_TICKS = 50;
export const SUPPLY_WELL_FED_MORALE_PER_TICK = 0.5;
export const SUPPLY_LOW_RATIONS_MORALE_PER_TICK = -1;
export const SUPPLY_HUNGER_MORALE_PER_TICK = -3;
export const SUPPLY_STARVATION_MORALE_PER_TICK = -5;
export const SUPPLY_LOW_RATIONS_SPEED_MULT = 0.90;
export const SUPPLY_HUNGER_SPEED_MULT = 0.80;
export const SUPPLY_HUNGER_COMBAT_MULT = 0.80;
export const SUPPLY_STARVATION_SPEED_MULT = 0.70;
export const SUPPLY_STARVATION_COMBAT_MULT = 0.60;
export const SUPPLY_STARVATION_FATIGUE_PER_TICK = 2;
export const SUPPLY_HUNGER_DESERTION_PER_TICK = 0.5;
export const SUPPLY_STARVATION_DESERTION_PER_TICK = 1.5;

// --- Experience (Step 9a) ---
export const EXP_KILL_THRESHOLD = 10;
export const EXP_PER_KILL_BATCH = 1;
export const EXP_ROUTE_ENEMY = 3;
export const EXP_ROUTE_RADIUS_TILES = 5;
export const EXP_HOLD_UNDER_BOMBARDMENT = 2;
export const EXP_HOLD_BOMBARDMENT_TICKS = 20;

// --- Morale Expansion (Step 9a) ---
export const MORALE_WINNING_ENGAGEMENT_BONUS = 5;
export const MORALE_WINNING_ENGAGEMENT_RADIUS_TILES = 5;
export const MORALE_ELITE_GUARD_AURA = 3.0;
export const MORALE_ELITE_GUARD_AURA_RADIUS_TILES = 3;
export const MORALE_GENERAL_KILLED_HIT = -30;
export const MORALE_ENCIRCLED_PER_TICK = -5;
export const MORALE_OUTNUMBERED_PER_TICK = -1;
export const MORALE_EXTENDED_COMBAT_PER_TICK = -0.5;
export const MORALE_EXTENDED_COMBAT_THRESHOLD_TICKS = 30;
export const MORALE_ARMY_ROUT_30_PERCENT = -20;
export const MORALE_ARMY_ROUT_50_PERCENT = -40;
export const MORALE_FAVORABLE_TERRAIN_BONUS = 2.0;

// --- Surrender System (Step 9c) ---
export const SURRENDER_CHECK_INTERVAL_TICKS = 10;
export const SURRENDER_PRESSURE_THRESHOLD = 80;
export const SURRENDER_CONSECUTIVE_CHECKS = 5;
export const SURRENDER_WEIGHT_MORALE = 0.30;
export const SURRENDER_WEIGHT_CASUALTY = 0.25;
export const SURRENDER_WEIGHT_SUPPLY = 0.20;
export const SURRENDER_WEIGHT_ENCIRCLEMENT = 0.15;
export const SURRENDER_WEIGHT_LEADERSHIP = 0.10;
export const ENCIRCLEMENT_QUADRANTS = 4;
export const ENCIRCLEMENT_CHECK_RADIUS = 15;
export const ENCIRCLEMENT_ENEMY_THRESHOLD = 3;

export const VictoryType = {
  SURRENDER: 0,
  ANNIHILATION: 1,
  GENERAL_KILLED: 2,
  STARVATION: 3,
} as const;
export type VictoryType = (typeof VictoryType)[keyof typeof VictoryType];
