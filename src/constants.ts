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
