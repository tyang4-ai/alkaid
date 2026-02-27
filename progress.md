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
| 5b | Deployment phase | DONE | DeploymentZone (5 template-specific zones), DeploymentManager (state machine: INACTIVE→DEPLOYING→COUNTDOWN→BATTLE), FormationTemplates (6 formations), DeploymentRenderer (zone overlay, ghost preview, command radius), DeploymentSidebar (roster, formation dropdown, begin button, countdown). Drag-drop from sidebar with ghost preview, formation auto-placement, 3-second countdown, enemy army auto-spawn, reserve spawning at 60 ticks. Ancient Chinese aesthetic (lacquered wood, cinnabar, jade, aged gold). 158 tests pass. |

## Phase 2: Game Mechanics

| Step | Description | Status | Notes |
|------|-------------|--------|-------|
| 6 | Pathfinding | DONE | A* (binary min-heap, octile heuristic, corner-cutting prevention), Dijkstra flow fields (group movement), SpatialHash (64px cells, 9-cell queries), PathManager (A* vs flow field decision, budget 5/tick, cache TTL 40 ticks). Unit-specific terrain cost overrides (cavalry impassable in mountains/marsh, Dao Swordsmen no forest penalty, naval water-only). Movement in UnitManager.tick() with last-mile direct movement. Right-click drag arrow for direct MOVE orders (DragArrowRenderer: dashed line + arrowhead, bypasses radial menu). 194 tests pass. |
| 7 | Command system | DONE | General unit type, CommandSystem with messenger delay (speed varies by command radius/order type/general alive), order queue (pause/unpause flush), misinterpretation when general dead (15%), MessengerRenderer (gold dots + fading trail), CommandRadiusRenderer (faint gold circle). Rally order (9th radial menu wedge). 10 new tests. |
| 8 | Combat system | DONE | CombatSystem (SpatialHash detection every 2 ticks, engagement/disengage), DamageCalculator (type matchups, terrain defense, armor, fatigue, experience, cavalry charge, Dao shield, crossbow volley, fire-while-moving), MoraleSystem (general nearby +1/tick, passive recovery, rout thresholds by exp tier, rout cascade, rally), SquadOps (combine/split), CombatRenderer (red attack lines), order effects in UnitManager.tick (HOLD/CHARGE/FORM_UP/DISENGAGE/RETREAT). 65 new tests (259 total). |
| 9a | War metrics: supply, fatigue, experience | DONE | SupplySystem (army food tracking, consumption/foraging, starvation, speed/combat penalties), FatigueSystem (movement/combat/idle fatigue, recovery, speed thresholds, weather/time modifiers), ExperienceSystem (kill-based +1/10 kills, bombardment +2/20 ticks, rout bonus +3, tier system 0-4, tier-up events), UnitInfoPanel (detail view with stats bars). Morale expanded: supply/fatigue penalties, Elite Guard aura, extended combat, army rout cascade (30%/50%), favorable terrain, outnumbered penalty. |
| 9b | Weather + time of day | DONE | EnvironmentState shared interface, WeatherSystem (5 types: clear/rain/fog/wind/snow, seeded RNG, adjacent transitions every 200 ticks at 20% chance), TimeOfDaySystem (6 phases: dawn/morning/midday/afternoon/dusk/night cycling every 200 ticks), EnvironmentHUD (top-center overlay with Chinese/English names + progress bar). Weather modifiers: rain -20%/-40% ranged, fog -20% ranged, snow 1.5x fatigue, midday 1.2x fatigue/1.3x supply. Night: -3 morale/tick for non-veterans in combat, -20% ranged accuracy. ~24 new tests. |
| 9c | Surrender system | DONE | SurrenderSystem (5-factor weighted pressure: morale 30%, casualty 25%, supply 20%, encirclement 15%, leadership 10%; quadrant-based encirclement detection; >=80 pressure for 5 consecutive checks = surrender), VictoryType enum (SURRENDER/ANNIHILATION/GENERAL_KILLED/STARVATION), BattleEndOverlay (full-screen victory/defeat with Chinese text 大勝/勝/敗/投降, battle summary, Continue button), annihilation + general-killed victory conditions in main.ts. ~16 new tests. |
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
- **2026-02-26**: Step 6 complete. Pathfinding. SpatialHash (grid-based O(1) neighbor queries), A* (binary min-heap, octile heuristic, 8-dir movement, corner-cutting prevention, unit-specific terrain costs), Dijkstra flow fields (group movement for 6+ units), PathManager (orchestrator with A* vs flow field decision, budget management, caching). UNIT_TERRAIN_COST_OVERRIDES for 8 unit types (cavalry, scouts, naval, dao swordsmen). Movement execution in UnitManager.tick() with last-mile direct movement. Wired in main.ts with EventBus path events. PATH_MAX_LENGTH increased from 500→5000 during testing. 36 new tests (194 total).
- **2026-02-26**: Right-click drag arrow. DragArrowRenderer (white dashed line + filled arrowhead in world-space effectLayer). InputManager extended with right-click drag state tracking (dead zone, rightDragStart/Move/End events in EventBus). Right-drag from selected units → visual arrow during drag → MOVE orders + pathfinding on release. Quick right-click still opens radial menu. Wired in main.ts render loop (interpolated center of selected units) + event handlers.
- **2026-02-26**: Steps 7+8 complete. Command System + Combat System. Separate General unit type (UnitType.GENERAL), CommandSystem with messenger delay (speed: 4.0 base/12.0 in-radius, retreat 1.5x, rally 0.5x, general-dead 0.5x + 15% misinterpret), order queue with pause/flush, MessengerRenderer (gold dots + fading trail), CommandRadiusRenderer. CombatSystem (SpatialHash-based detection, engagement, DamageCalculator with full formula, MoraleSystem with rout/rally/cascade, SquadOps combine/split). Order effects (HOLD +10% def, CHARGE 1.3x speed +fatigue, FORM_UP +20% armor, DISENGAGE break combat). Rally as 9th radial menu wedge. CombatRenderer (red attack lines). HP-pool damage model (accumulates partial damage). 259 tests pass.
- **2026-02-26**: Step 5b complete. Deployment phase. DeploymentZone with 5 template-specific zone generators (open_plains, mountain_pass, river_valley density-based, siege, wetlands). DeploymentManager state machine (INACTIVE→DEPLOYING→COUNTDOWN→BATTLE) with roster management, formation auto-placement, countdown timer, reserve spawning. 6 FormationTemplates (Standard Line, Crescent, Echelon Left/Right, Defensive Square, Ambush). DeploymentRenderer (gold zone overlay baked to RenderTexture, ghost preview shapes, command radius). DeploymentSidebar (roster with shape icons + Chinese/English names, formation dropdown, Begin Battle button, countdown overlay). Drag-drop with suppressLeftDrag to prevent camera pan. Ancient Chinese aesthetic colors (lacquered rosewood, cinnabar, jade, aged gold). 158 tests pass.
