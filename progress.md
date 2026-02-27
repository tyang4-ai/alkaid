# Alkaid (破军) — Implementation Progress

Last updated: 2026-02-26

## Phase 1: Core Engine

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Project scaffolding + game loop | DONE | pnpm+Vite+PixiJS 8.16+Vitest. GameLoop (20Hz), EventBus, Renderer, FPS counter. 24 tests pass. |
| 2 | Terrain generation + rendering | DONE | Simplex fBm elevation+moisture, 5 map templates, river gen, biome assignment, 4-bit auto-tile bitmask, marching squares contour lines, RenderTexture baking. 29 new tests (53 total). |
| 3 | Camera system | DONE | WASD/arrow/edge-scroll panning, scroll-wheel zoom (cursor-anchored), middle-click drag, smooth lerp, bounds clamping. Camera (pure data) + InputManager (DOM events) + Renderer worldContainer restructure. 34 new tests (87 total). |
| 4 | Unit spawning + rendering | DONE | 13 unit types with full stats, UnitManager, UnitRenderer (5 shapes, team colors, RenderTexture), test armies, 110 tests pass. |
| 5 | Selection + input | DONE | SelectionManager, OrderManager, SelectionRenderer (pulsing gold rings), OrderRenderer (dashed lines + flags), RadialMenu (8 Chinese-labeled wedges), InputManager (Ctrl+drag box-select, right-click, shift+click, ESC). 130 tests pass. |
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
- **2026-02-27**: Step 2 complete. Terrain generation + rendering. SeededRandom (mulberry32), simplex-noise fBm, 5 map templates (river_valley, mountain_pass, open_plains, wetlands, siege), river generation, biome assignment, 4-bit auto-tile bitmask, marching squares contour lines, RenderTexture baking. 53 tests pass. `__alkaid.regen(seed, template)` for debug regeneration.
- **2026-02-27**: Step 3 complete. Camera system. Pure-data Camera class (pan, zoom, lerp, bounds clamping, coordinate conversion). InputManager (WASD/arrows, edge scroll, middle-click drag, scroll-wheel zoom). Renderer restructured with worldContainer for camera transforms, uiLayer stays fixed. 87 tests pass.
- **2026-02-26**: Step 4 complete. Unit spawning + rendering. 13 UnitType enum + configs (stats from ref-unit-stats.md), UnitCategory, UnitState, 10x10 TYPE_MATCHUP_TABLE. Unit data interface, UnitManager (spawn/destroy/get/tick/clear + EventBus events). UnitRenderer with RenderTexture-cached shape textures (circle/triangle/diamond/square/hexagon), team colors, interpolation, strength-based scale+opacity. TestScenario spawns 2 opposing armies. HUD shows unit count. 110 tests pass.
- **2026-02-26**: Step 5 complete. Selection + input. SelectionManager (click select, shift+toggle, box-select, deselect). OrderManager (one order per unit, 8 order types). InputManager extended: Ctrl+drag box-select, right-click events, ESC deselect. SelectionRenderer (pulsing gold rings in world space, box-select rect in screen space). OrderRenderer (dashed lines + flag pennants). RadialMenu (8 wedges with Chinese labels, hover highlight, order dispatch). All wired in main.ts with EventBus. 130 tests pass.
