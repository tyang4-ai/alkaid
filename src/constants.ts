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
