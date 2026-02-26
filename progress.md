# Alkaid (破军) — Implementation Progress

Last updated: 2026-02-26

## Phase 1: Core Engine

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Project scaffolding + game loop | DONE | pnpm+Vite+PixiJS 8.16+Vitest. GameLoop (20Hz), EventBus, Renderer, FPS counter. 24 tests pass. |
| 2 | Terrain generation + rendering | TODO | Simplex noise, contour lines, 5 templates |
| 3 | Camera system | TODO | Pan, zoom, bounds |
| 4 | Unit spawning + rendering | TODO | 13 unit types, dot sizing, interpolation |
| 5 | Selection + input | TODO | Click, box-select, right-click orders |
| 5b | Deployment phase | TODO | Drag-drop, 5 formations, reserve system |

## Phase 2: Game Mechanics

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 6 | Pathfinding | TODO | A*, flow fields, spatial hash |
| 7 | Command system | TODO | General, messenger delay, order queue |
| 8 | Combat system | TODO | Damage calc, type counters, combine/split |
| 9 | War metrics | TODO | Morale, supply, fatigue, exp, weather, time of day, supply chains, ambush, surrender |
| 10 | Battle HUD + alerts | TODO | Raw numbers, alert system, speed controls, hotkeys, retreat |
| 10b | In-game codex | TODO | Unit/terrain/weather/mechanics reference |
| 10c | After-action report | TODO | Stats, timeline, key moments |
| 10d | Victory/defeat cinematics | TODO | Dramatic end-of-battle sequences |

## Phase 3: Campaign + Persistence

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 11 | Save system | TODO | LocalStorage + IndexedDB, auto-save, export/import |
| 12 | Campaign map + recruitment + roguelike | TODO | 20 territories, recruitment, unlocks, random events |
| 13 | Fog of war + scouting | TODO | Vision, LOS, scout detection |

## Phase 4: AI Opponent

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 14 | Rule-based AI | TODO | 4 personalities, same command constraints |
| 15 | Python training env + reward design | TODO | PPO, reward shaping, parity framework, evaluation |
| 16 | Browser AI integration + adaptation | TODO | ONNX in Web Worker, adaptation layer, difficulty tiers |

## Phase 4b: QoL + Tech

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 14b | Web Workers | TODO | Pathfinding + AI off main thread |
| 14c | Minimap, tooltips, undo, order queue | TODO | Interactive minimap, hover tooltips, Ctrl+Z |
| 14d | Replay + accessibility | TODO | Deterministic replay, colorblind, UI scale, rebinding |
| 14e | Performance monitoring | TODO | Debug overlay, FPS, tick time, memory |

## Phase 5: Art + Polish

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 17 | Asset creation (Gemini) | TODO | 16x16 sprites, terrain tiles, UI elements |
| 18 | Visual polish | TODO | Animations, transitions, weather effects |
| 19 | Audio | TODO | Battle sounds, ambient, music |

---

## Session Log
- **2026-02-25**: Design phase complete. All reference docs written. Plan approved. Ready to begin Step 1.
- **2026-02-26**: Step 1 complete. Vite+pnpm scaffold, PixiJS 8.16.0+Vitest. All core files written (constants, EventBus, GameState, GameLoop, Renderer, main.ts). 24 unit tests pass. Dev server at localhost:3000.
