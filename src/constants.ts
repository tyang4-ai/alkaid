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
