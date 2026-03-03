# Alkaid (破军) — Ancient Chinese War Simulator

## Project Overview
**Alkaid** (破军星, Pòjūn — "Army Breaker"), named after the tip star of the Big Dipper, the most warlike star in Chinese astrology. A web-based, single-player war simulator inspired by War of Dots and TABS, set in ancient China. Squad-based real-time combat with pause, realistic war mechanics, procedurally generated terrain, roguelike campaign, and RL-trained AI.

## Tech Stack
- TypeScript + PixiJS v8 + Vite
- ONNX Runtime Web / TensorFlow.js (AI, later phase)
- LocalStorage + IndexedDB (save system)

## Plan & Reference Documents
All design documents are located at:
- **Main plan:** `C:\Users\22317\.claude\plans\wise-tinkering-pillow.md`
- **Unit stats reference:** `C:\Users\22317\.claude\plans\ref-unit-stats.md` — All 13 unit stat blocks, damage formula, type matchup table
- **Game mechanics reference:** `C:\Users\22317\.claude\plans\ref-game-mechanics.md` — Morale, supply, fatigue, experience, command, weather, terrain, surrender, time of day, supply chains, ambush, historical data mapping, campaign, save system
- **Recruitment & setup reference:** `C:\Users\22317\.claude\plans\ref-recruitment-and-setup.md` — Recruitment costs, deployment phase, formations, roguelike progression, random events, army limits

**IMPORTANT:** When implementing any game system, ALWAYS read the corresponding reference document first for exact numbers, formulas, and edge cases. Do not guess values — they are historically researched and specified.

## Pre-Step Protocol: Ask Before Building
**Before implementing EACH step**, the agent MUST:
1. Read the step requirements from the plan + relevant reference docs
2. Think about what's ambiguous (mechanics, style, edge cases, priorities)
3. Ask the user 1-5 clarification questions using `AskUserQuestion`
4. Wait for answers before writing any code
5. Err on the side of asking too many questions rather than making assumptions

## Frontend Design
- Use the `frontend-design` skill for ALL UI/screen implementation
- After implementing, use Chrome MCP to visually verify and tweak
- Visual direction: ancient Chinese military map aesthetic, dark/muted tones, parchment backgrounds, ink-black text, information-dense but organized
- See the main plan's "Frontend Design Protocol" section for full details

## Progress Tracking
- **Progress file:** `C:\Users\22317\Documents\Coding\war game\progress.md`
- **ALWAYS update progress.md after completing each task/sub-task** — not just major steps
- Mark steps as: TODO, IN PROGRESS, DONE, or BLOCKED
- Include brief notes about what was done in the Notes column

## Superpowers Skills
**ALWAYS check and use superpowers skills before any task.** Key skills:
- `superpowers:brainstorming` — before any creative/feature work
- `superpowers:writing-plans` — before multi-step implementation
- `superpowers:executing-plans` — when implementing a written plan
- `superpowers:systematic-debugging` — before fixing any bug
- `superpowers:verification-before-completion` — before claiming work is done
- `superpowers:requesting-code-review` — after completing major features
- `frontend-design` — for ALL UI/screen implementation

## Testing Protocol
- **Vitest** for unit testing core logic (GameLoop, EventBus, GameState, etc.)
- **Chrome MCP** tools (`mcp__claude-in-chrome__*`) for visual verification and gameplay testing
- After each step: navigate to dev server, screenshot, inspect console, test interactions
- See the main plan for specific Chrome MCP checks per phase

## Key Architecture Rules
1. **Strict simulation/rendering separation** — `src/simulation/` must NEVER import from `src/rendering/`
2. **Fixed 20Hz simulation tick** decoupled from 60fps render (accumulator pattern)
3. **Data-oriented design** — units are plain data interfaces, behavior in manager systems
4. **Event bus** for cross-system communication
5. **Web Workers** for pathfinding and AI inference (off main thread)
6. **All game constants** in `src/constants.ts` — must match Python training env

## Parallel Sub-Step Development
For every future step, **before implementation**, analyze whether sub-steps can be developed in parallel:
1. Identify sub-tasks within the step that have **no logical dependencies** on each other (no shared mutable state, only append-only changes to shared files like constants.ts/EventBus.ts/main.ts)
2. If parallelizable: create **separate git worktrees** for each independent sub-task, develop them simultaneously, then merge sequentially back to the main branch
3. **Chrome MCP visual testing is always deferred** until after ALL sub-steps for a given step are merged to the main branch — never test mid-merge
4. Resolve merge conflicts in shared files by concatenating additions (constants, events, main.ts tick calls)
5. **Coordinator pre-defines shared contracts before dispatch**: Pre-lock function signatures (parameter names/types/order), assign constant sections with comment headers, pre-define EventBus event names+payloads, specify main.ts insertion points, and document unit conventions (fractions vs percentages, optional vs required fields)
6. **Always commit or stash all uncommitted changes** before creating worktree branches — uncommitted changes on the base branch cause significant merge complexity

## Build Order
Follow the numbered steps in the main plan sequentially. Each step has a **Verify** checkpoint — complete it before moving on. The phases are:
1. Core Engine (Steps 1-5b)
2. Game Mechanics (Steps 6-10d)
3. Campaign + Persistence (Steps 11-13)
4. AI Opponent (Steps 14-16)
4b. QoL + Tech (Steps 14b-14f)
5. Art + Polish (Steps 17-19)

## Git Workflow
- **Default branch:** `main` — always branch from `main`, merge back to `main`
- **Branch naming:** `feat/<step>-<description>`, `fix/<description>`, `docs/<description>`, `chore/<description>`
- **Commits:** Conventional commit prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`). Keep messages concise, focused on "why" not "what"
- **Feature branches:** One branch per step or feature. Use worktrees for parallel sub-step work
- **No direct pushes to `main`** for multi-file changes — use feature branches and merge locally or via PR
- **Keep `main` green:** All tests must pass before merging to `main`
- **No force-push to `main`** — ever
- **Tag releases** at phase boundaries (e.g., `v0.1-core-engine`, `v0.2-mechanics`)
- **Push regularly** — push after each completed step or meaningful milestone
