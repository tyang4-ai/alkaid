# Alkaid (破军) — Ancient Chinese War Simulator (Godot Edition)

## Project Overview
**Alkaid** (破军星, Pojun -- "Army Breaker"), named after the tip star of the Big Dipper, the most warlike star in Chinese astrology. A single-player war simulator set in ancient China, built in Godot 4 for Steam release. Squad-based real-time combat with pause, realistic war mechanics, procedurally generated terrain, roguelike campaign, and RL-trained AI.

The existing 37K-line TypeScript+PixiJS codebase is the complete spec. This project ports it to Godot with a hybrid C#/GDScript architecture.

## Tech Stack
- **Engine:** Godot 4.6.1 / C# (.NET 8) + GDScript
- **AI inference:** Microsoft.ML.OnnxRuntime (NuGet)
- **Steam:** Steamworks.NET (NuGet)
- **Visual testing:** GDAI MCP (satelliteoflove/godot-mcp)
- **Unit testing:** NUnit for C# simulation tests

## Plan & Reference Documents
All design documents are located at:
- **Main plan:** `C:\Users\22317\.claude\plans\encapsulated-pondering-charm.md`
- **TypeScript reference (the spec):** `C:\Users\22317\Documents\Coding\war game` -- the complete original codebase
- **Unit stats reference:** `C:\Users\22317\.claude\plans\ref-unit-stats.md` -- All 13 unit stat blocks, damage formula, type matchup table
- **Game mechanics reference:** `C:\Users\22317\.claude\plans\ref-game-mechanics.md` -- Morale, supply, fatigue, experience, command, weather, terrain, surrender, time of day, supply chains, ambush, historical data mapping, campaign, save system
- **Recruitment & setup reference:** `C:\Users\22317\.claude\plans\ref-recruitment-and-setup.md` -- Recruitment costs, deployment phase, formations, roguelike progression, random events, army limits
- **Glossary:** `glossary.md` (project root) -- All 13 unit types, 10 orders, 4 AI personalities, 7 roles, terrains, weather, victory types, with Chinese names, English names, and variable names

**IMPORTANT:** When implementing any game system, ALWAYS read the corresponding reference document first for exact numbers, formulas, and edge cases. Do not guess values -- they are historically researched and specified.

---

## The Language Boundary

```
+---------------------------------------------------+
|  GDScript Layer (hot reload, visual iteration)    |
|                                                   |
|  Scenes, Renderers, UI Controls, Input,           |
|  Camera, Audio, Particles, Shaders                |
|                                                   |
|  READS FROM C# (data properties, signals)         |
|  NEVER contains game logic or formulas            |
+---------------------------------------------------+
|  C# Layer (type-safe, performant, testable)       |
|                                                   |
|  UnitManager, CombatSystem, MoraleSystem,         |
|  PathManager, AIController, RLController,         |
|  SupplySystem, FatigueSystem, ExperienceSystem,   |
|  WeatherSystem, CommandSystem, SurrenderSystem,   |
|  CampaignManager, SaveManager, ONNX Inference     |
|                                                   |
|  EXPOSES data via properties + signals            |
|  NEVER references scene nodes or UI               |
+---------------------------------------------------+
```

## Key Architecture Rules

1. **C# = simulation logic. GDScript = rendering, UI, input, audio. NEVER mix.** C# must never reference scene nodes or UI elements. GDScript must never contain game logic or formulas.
2. **C# exposes data via properties + signals. GDScript reads and renders.** This is the only direction of data flow across the language boundary.
3. **Two communication channels -- Signals for events, direct references for queries.** Signals for "something happened" (fire-and-forget). Direct refs via `BattleSystems` for "what's the current state?" (synchronous). "Signals only" is NOT the rule.
4. **System Node Pattern:** Every simulation system implements `IGameSystem` with methods: `Initialize(BattleSystems)`, `Tick(int currentTick)`, `Reset()`, `Serialize()`, `Deserialize()`.
5. **Typed `BattleSystems` dependency container, NOT `Dictionary<string, Node>`.** Compile-time type checking. No string lookups. Every system receives `BattleSystems` in `Initialize()`.
6. **Explicit tick order in `BattleTickRunner`, NOT scene tree child order.** Ordering is explicit, numbered, in one place. Adding a system = adding one line at the right position.
7. **All game data in `res://data/*.json`** -- single source of truth shared with Python training environment. Constants, unit stats, matchups, terrain config, environment settings.
8. **20 Hz physics tick** (`physics_ticks_per_second = 20`), decoupled from rendering. Simulation runs in `_physics_process`, rendering interpolates in `_process`.

---

## Pre-Step Protocol: Ask Before Building
**Before implementing EACH step**, the agent MUST:
1. Read the step requirements from the plan + relevant reference docs
2. Think about what's ambiguous (mechanics, style, edge cases, priorities)
3. Ask the user 1-5 clarification questions using `AskUserQuestion`
4. Wait for answers before writing any code
5. Err on the side of asking too many questions rather than making assumptions

## Superpowers Skills
**MANDATORY: ALWAYS invoke superpowers skills before ANY task. This is not optional -- skills MUST be used for every task, every time, no exceptions.** Key skills:
- `superpowers:brainstorming` -- before any creative/feature work
- `superpowers:writing-plans` -- before multi-step implementation
- `superpowers:executing-plans` -- when implementing a written plan
- `superpowers:systematic-debugging` -- before fixing any bug
- `superpowers:verification-before-completion` -- before claiming work is done
- `superpowers:requesting-code-review` -- after completing major features
- `frontend-design` -- for ALL UI/screen implementation

## Progress Tracking
- **Progress file:** `C:\Users\22317\Documents\Coding\alkaid-godot\progress.md`
- **ALWAYS update progress.md after completing each task/sub-task** -- not just major steps
- Mark steps as: TODO, IN PROGRESS, DONE, or BLOCKED
- Include brief notes about what was done in the Notes column

---

## GDAI MCP Protocol (Visual Testing)

Use the GDAI MCP (godot-mcp) for all visual verification:
- **Screenshot editor** -- verify scene tree structure, node layout, resource assignments
- **Screenshot running game** -- verify runtime rendering, UI placement, visual effects
- **Read scene tree** -- inspect node hierarchy and properties
- **Read debugger** -- check for errors, warnings, print output
- **Press keys** -- test input handling and interactions

**After implementing any visual feature**, always take a screenshot via GDAI MCP to verify it looks correct before marking the task as done.

---

## Testing Protocol

- **NUnit** for C# simulation unit tests (`tests/` directory)
  - All simulation systems must have unit tests
  - Test against exported TypeScript test fixtures where applicable
- **GDAI MCP** for visual verification and gameplay testing
  - Screenshot editor + running game after each visual change
  - Read debugger output to verify no errors
- **ONNX parity test** (hard gate before Phase 5):
  - Port `buildObservation()` to C#
  - Run against Python's `obs_builder.py` with identical fixtures
  - Max delta < 1e-5 across all observation floats
  - Same observation must produce same decoded actions

---

## Scaffold Generator

Use the scaffold generator to accelerate porting TypeScript systems to C#:

```bash
python tools/scaffold.py --from src/simulation/combat/MoraleSystem.ts --to alkaid-godot/src/Simulation/Combat/MoraleSystem.cs
```

Generates a C# stub with: class declaration, signal delegates, method signatures (PascalCase), TODO markers with TS line numbers, typed properties. The TS-to-C# translation is nearly mechanical syntax conversion.

---

## Error Handling

- **Try-catch around every system tick** in `BattleTickRunner`. One system crashing must not kill the entire tick -- log the error and continue.
- **Ring-buffer logger** -- last 1000 entries, stored in memory. On crash, dump to `user://logs/`.
- **Atomic saves** -- write to `.tmp` file first, then rename to `.json`. Keep one backup (`.bak`). Never write directly to the save file.

---

## Build Order

Follow the numbered phases in the main plan sequentially. Each phase has a **Verify** checkpoint -- complete it before moving on.

| Phase | What | Playable result |
|---|---|---|
| 0 | Infrastructure: project, GDAI, scaffold, glossary, ONNX fix | Project compiles, Claude can screenshot |
| 1 | Core: camera, input, settings | Pan/zoom empty scene |
| 2 | Terrain generation + rendering | Generated maps to explore |
| 3 | Full battle + Feel features | Complete battle with visual juice |
| 4 | Campaign | Full roguelike campaign loop |
| 5 | ONNX AI | RL-trained AI on Hard/Brutal |
| 6 | Steam + polish | Shippable .exe with Steam integration |
| 7A-E | Addiction roadmap features | Layered improvements, each playable |

---

## Git Workflow
- **Default branch:** `main` -- always branch from `main`, merge back to `main`
- **Branch naming:** `feat/<step>-<description>`, `fix/<description>`, `docs/<description>`, `chore/<description>`
- **Commits:** Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Keep messages concise, focused on "why" not "what". **Do NOT add Co-Authored-By lines, "written by" attribution, or any AI attribution in commit messages -- never.**
- **Feature branches:** One branch per step or feature. Use worktrees for parallel sub-step work.
- **No direct pushes to `main`** for multi-file changes -- use feature branches and merge locally or via PR.
- **Keep `main` green:** All tests must pass before merging to `main`.
- **No force-push to `main`** -- ever.
- **Tag releases** at phase boundaries (e.g., `v0.1-core-engine`, `v0.2-mechanics`).
- **Push regularly** -- push after each completed step or meaningful milestone.
- **Commit cadence:** Commit after every sub-step or every 5 tasks, whichever comes first. Do NOT accumulate large uncommitted changes.

## Parallel Sub-Step Development
For every future step, **before implementation**, analyze whether sub-steps can be developed in parallel:
1. Identify sub-tasks within the step that have **no logical dependencies** on each other
2. If parallelizable: create **separate git worktrees** for each independent sub-task, develop them simultaneously, then merge sequentially back to the main branch
3. **GDAI MCP visual testing is always deferred** until after ALL sub-steps for a given step are merged to the main branch -- never test mid-merge
4. Resolve merge conflicts in shared files by concatenating additions
5. **Coordinator pre-defines shared contracts before dispatch**: Pre-lock function signatures, assign constant sections, pre-define signal names+payloads, and document unit conventions
6. **Always commit or stash all uncommitted changes** before creating worktree branches

---

## Project Paths

| What | Path |
|---|---|
| Godot project (this repo) | `C:\Users\22317\Documents\Coding\alkaid-godot` |
| TypeScript reference (the spec) | `C:\Users\22317\Documents\Coding\war game` |
| Main plan | `C:\Users\22317\.claude\plans\encapsulated-pondering-charm.md` |
| Glossary | `glossary.md` (project root) |
| Unit stats ref | `C:\Users\22317\.claude\plans\ref-unit-stats.md` |
| Game mechanics ref | `C:\Users\22317\.claude\plans\ref-game-mechanics.md` |
| Recruitment ref | `C:\Users\22317\.claude\plans\ref-recruitment-and-setup.md` |
