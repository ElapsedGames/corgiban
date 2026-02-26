# Corgiban Project Plan

This document defines the implementation constraints, architecture, and phased delivery plan for Corgiban.
It preserves the same technical requirements as the prior prompt-form version, expressed as a project plan.

====================================================================
0) GLOBAL RULES (NON-NEGOTIABLE)
====================================================================

A) Determinism and purity
- Game engine and solver logic must be deterministic and side-effect free.
- No DOM/Web APIs in domain packages (core/solver). React imports are allowed only in adapter
  surfaces (`apps/web`, and optional `packages/embed` when introduced).

B) Performance and threading
- Anything potentially heavy (solvers, benchmarks, heuristics, search loops) runs in Web Workers.
- Main thread handles UI, orchestration, and rendering only.

C) File size and responsibility limits
- Target 300-500 lines/file where feasible.
- Split by responsibility before a file exceeds ~800 lines.

D) Change strategy
- Prefer additive changes + migrate call sites rather than in-place rewrites.
- Avoid sweeping renames or repo-wide pattern conversions in one PR.

E) Testing and coverage gates
- Enforce >=95% lines/branches/functions/statements repo-wide.
- Domain packages (core/solver) should target 98-100%.
- Most bug fixes require a regression test.

F) Boundary direction
- Adapters (React/UI handlers/pages) must NOT import persistence directly.
- UI calls workflows (RTK thunks); workflows call ports; ports call adapters.

====================================================================
1) TARGET END-STATE ARCHITECTURE (DECISIONS ARE ALREADY MADE)
====================================================================

Use a pnpm workspaces monorepo with this structure:

/apps
  /web
    /app
      /ui
      /canvas
        buildRenderPlan.ts
        draw.ts
      /routes
        play.tsx
        bench.tsx
        dev.ui-kit.tsx
      /state
      /styles
        tokens.css
      root.tsx
      entry.client.tsx
      entry.server.tsx
    vite.config.ts   (Remix in Vite mode)
    tailwind.config.ts
    vitest.config.ts

/packages
  /shared
    src/
      types.ts
      constraints.ts
      invariants.ts
      result.ts
  /levels
    src/
      builtinLevels.ts
      levelSchema.ts
  /core
    src/
      model/
        cell.ts
        direction.ts
        position.ts
        level.ts
        gameState.ts
      engine/
        applyMove.ts
        undo.ts
        restart.ts
        rules.ts
      encoding/
        parseLevel.ts
        serializeLevel.ts
      hashing/
        hash.ts
        normalize.ts
  /solver
    src/
      api/
        solverTypes.ts
        algorithm.ts
        registry.ts
        selection.ts
      algorithms/
        bfsPush.ts
        astarPush.ts
        idaStarPush.ts
      heuristics/
        manhattan.ts
        assignment.ts
      deadlocks/
        corners.ts
        frozen.ts
      infra/
        frontier.ts
        visited.ts
        cancelToken.ts
        progress.ts
  /worker
    src/
      protocol/
        protocol.ts
        schema.ts
      runtime/
        solverWorker.ts
        throttle.ts
      client/
        solverClient.client.ts
        workerPool.client.ts
  /benchmarks
    src/
      model/
        benchmarkTypes.ts
      runner/
        benchmarkRunner.ts
  /embed
    src/
      index.ts
      corgibanEmbed.ts
  /solver-kernels
    src/
      index.ts
      reachability.ts
      hashing.ts

/tools
  /src
    bestPracticesReport.ts
  package.json
  tsconfig.json

/docs
  Architecture.md
  dev-tools-spec.md
  project-plan.md
  Engineering-Process-Playbook.md
  /adr
    (create ADRs for major decisions when you introduce or change them)

====================================================================
1B) PRODUCT-ALIGNED TECHNOLOGY PLACEMENTS (BOUNDED ADAPTERS)
====================================================================

Principle: Each technology must be a well-bounded adapter. Do not let these dependencies leak into core/solver.

Summary table:

| Tech                                                    | Placement in Corgiban                                                                              | Product value                                                        | Cost / risk                                                            | Recommendation                         |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| Web Workers                                             | Solver runs; benchmark runner; optional worker pool                                                 | Keeps UI responsive; enables concurrency; makes benchmarks practical | Requires protocol discipline + cancellation                            | Core requirement                        |
| Web Components                                          | `packages/embed` exporting `<corgiban-embed>` with Shadow DOM + scoped stylesheet injection           | Embeddable play surface that resists host CSS collisions              | Requires isolated style artifact + lifecycle integration tests          | Planned Phase 6                         |
| Remix                                                   | `apps/web` primary app shell from Phase 0                                                            | SSR/streaming + server actions + routing in one framework             | Requires Remix conventions from day one                                 | Core requirement (Phase 0)               |
| Browser dev environments (WebContainers/Sandpack)       | Level Lab `/lab` route; WebContainers/Sandpack added later behind "Dev Tools" section               | Reproducibility; turns app into a tool                                | WebContainers is a heavy dependency; Level Lab alone is low-cost        | Level Lab: Phase 6; WebContainers: Phase 7+ |
| WebAssembly                                             | `packages/solver-kernels` for hot loops; TS interface first, Rust + `wasm-pack` when promoted       | Real perf wins on large suites                                        | Toolchain/debug overhead + binary loading strategy complexity           | Phase 6, after profiling data from bench |
| Advanced browser APIs                                   | IndexedDB, File System Access, PerformanceObserver + performance.mark/measure, navigator.storage.persist(), PWA/service worker, OffscreenCanvas | Durability, sharing, perf visibility, offline use, reduced main-thread rendering | Some APIs need fallbacks; cross-origin isolation only needed for SharedArrayBuffer (avoid it) | Phase 4-5; all six listed APIs are in scope |

Concrete placements:
1) Web Workers (must-have): worker pool for benchmarks capped at navigator.hardwareConcurrency; progress throttling; deterministic cancellation. Do NOT use SharedArrayBuffer/Atomics - postMessage protocol only (avoids COOP/COEP deployment constraints).
2) Web Components (Phase 6): `packages/embed` with `<corgiban-embed>` attributes (level-id, level-data, readonly, show-solver, theme) and DOM events (corgiban:solved, corgiban:move, corgiban:benchmarkComplete). Default to Shadow DOM with scoped stylesheet injection. Bundle React as a dependency (not a peer dependency) so the embed remains self-contained on any host page. Write an ADR documenting custom-element lifecycle and cleanup.
3) Remix (Phase 0 baseline): `apps/web` is a Remix app from the start. Use Remix routing/data APIs as the primary app model while keeping domain packages unchanged and framework-agnostic.
4) Level Lab (Phase 6): `/lab` route with level editor + preview, run solver/bench, export/import JSON. Add Sandpack/WebContainers integration later (Phase 7) behind a "Dev Tools" section via dynamic import and a feature flag; it must remain optional and not required for normal product usage.
5) WASM kernels (Phase 6, post-profiling): implement TS version first behind the same interface; promote only benchmark-proven hotspots to Rust + `wasm-pack`. Load WASM lazily inside workers via `fetch` + `WebAssembly.instantiateStreaming` (fallback to `WebAssembly.instantiate`). Candidates: reachability flood fill, state hashing, assignment heuristic, bitset operations.
6) Advanced APIs (Phase 4-5): IndexedDB (benchmark persistence via adapter) + File System Access API (export/import level packs and benchmark reports) + PerformanceObserver + performance.mark/measure (solver latency and render timing) + navigator.storage.persist() (durable IndexedDB on first benchmark run) + PWA/service worker (offline caching) + OffscreenCanvas (worker-side sprite pre-rendering, Phase 6). Do not use SharedArrayBuffer.

Support + fallback matrix (minimum):

| Capability | Expected support posture | Primary path | Fallback path |
| --- | --- | --- | --- |
| File System Access API | Chromium-first; not universal | Native open/save dialogs for level packs and benchmark exports | File input + anchor-download (`Blob`/`URL.createObjectURL`) |
| OffscreenCanvas | Not universal across browsers/contexts | Worker-side pre-rendering/asset prep where supported | Main-thread Canvas renderer (`buildRenderPlan` + `draw`) |
| PWA Service Worker | Varies by host/protocol and embedding constraints | Workbox app-shell/offline caching on supported HTTPS hosts | No-SW network mode; app remains functional without offline guarantees |

====================================================================
2) HARD PACKAGE BOUNDARIES (ENFORCE WITH TS + ESLINT)
====================================================================

- packages/core imports ONLY: packages/shared, packages/levels
- packages/solver imports ONLY: packages/core, packages/shared
- packages/worker imports ONLY: packages/solver, packages/core, packages/shared, packages/benchmarks
- packages/benchmarks imports ONLY: packages/solver, packages/core, packages/shared
- apps/web imports packages ONLY through their public entrypoints (package root exports)
- packages/embed (when introduced) is an adapter package; it may import React and package public
  entrypoints, and must not be imported by domain packages. Embed bundles React as a dependency
  (self-contained runtime), not as a peer dependency.

Enforce with:
- boundary-rules.mjs at repo root: define package direction rules and architectural path
  restrictions once. ESLint and dependency-cruiser both import from this file to avoid rule drift.
- TypeScript project references (tsc -b): each package tsconfig.json references only its allowed
  dependencies; apps/web references all packages through their public entrypoints only.
- package.json exports field: each package exposes only { ".": "./src/index.ts" }; deep imports
  (e.g. packages/core/src/model/gameState) fail at the TypeScript compiler level before any lint
  rule fires. This is the primary structural enforcement.
- ESLint eslint-plugin-boundaries: one element per package; boundary rules above expressed as
  plugin rules. Catches direction violations, adapter-to-storage access, and worker creation
  outside `*.client.ts` modules. Runs as part of pnpm lint.
- ESLint no-restricted-globals + no-restricted-syntax: ban SharedArrayBuffer and Atomics in all
  production source, including globalThis.SharedArrayBuffer/globalThis.Atomics forms; ban Date in
  packages/core/** and packages/solver/** (determinism requirement), including globalThis.Date.
  Runs as part of pnpm lint.
- dependency-cruiser: dependency-cruiser.config.mjs at repo root imports boundary-rules.mjs and
  enforces import-graph rules for supplementary validation and graph generation.
  Run on-demand via pnpm exec depcruise --validate dependency-cruiser.config.mjs packages/ apps/.

====================================================================
3) DOMAIN MODEL AND ENGINE REQUIREMENTS
====================================================================

Levels use a static+dynamic split:
- staticGrid: walls + targets (immutable)
- dynamicState: player position + box positions

Level data should remain editor-friendly and compatible with minified string rows from the existing implementation:
- LevelDefinition: { id, name, rows: string[], knownSolution?: string | false, ... }
- Compile to LevelRuntime: { width, height, staticGrid, initialPlayerIndex, initialBoxes }

Core engine API (pure):
- createGame(levelRuntime): GameState
- applyMove(state, direction): { state: GameState, changed: boolean, pushed: boolean }
- undo(state): GameState
- restart(state): GameState
- isWin(state): boolean
- (optional) getLegalMoves(state): Direction[]

GameState must be serializable and deterministic:
- levelId
- staticGrid reference (or an id + lookups)
- playerIndex
- boxes (sorted indices array or bitset)
- history stack with minimal diffs for undo
- stats (moves, pushes)

Invariants must be validated in tests:
- player not on wall
- boxes do not overlap
- boxes not on walls

Move string contract:
- Canonical direction encoding defined once in packages/shared/src/types.ts:
  export type Direction = 'U' | 'D' | 'L' | 'R'; // U=up D=down L=left R=right
- All move strings, knownSolution fields, solver output, and sequence inputs use this encoding. No other encoding exists in the repo.
- When porting legacy levels, verify and re-encode any knownSolution strings to UDLR before committing.

Validation constraints (packages/shared/src/constraints.ts):
- MAX_GRID_WIDTH = 64, MAX_GRID_HEIGHT = 64
- MAX_BOXES = 32
- MAX_BENCH_SUITE_LEVELS = 200
- MAX_IMPORT_BYTES = 1_048_576 (1 MB)
Both packages/core (parseLevel) and the import parser enforce these using the same constants. Reject malformed rows at parse time with a descriptive error message. Imported JSON is size-checked before JSON.parse, then strict-schema validated after parse (unknown keys rejected).

====================================================================
4) SOLVER REQUIREMENTS
====================================================================

Solver action model MUST be push-based:
- Search graph edges are box pushes; between pushes compute player reachability.
- Return solution as move string for playback (expand macro pushes to UDLR steps).

Baseline algorithms (start with one, structure for many):
- BFS push-based (minimum viable)
- A* push-based (optional in first pass if time; keep interface ready)
- IDA* (optional later; stub/placeholder acceptable)

Solver API:
- solve(levelRuntime, options, hooks) -> SolveResult
- deterministic given same inputs
- cooperative cancellation via CancelToken (checked every N expansions)
- progress callbacks are throttled and stable

Add at least one deadlock pruning rule early:
- corner deadlocks (box in a corner not on target)

Heuristics:
- Manhattan sum baseline
- keep assignment heuristic as optional module (can be stubbed initially, but scaffold the interface)

Algorithm selection (packages/solver/api/selection.ts):
- analyzeLevel(levelRuntime): LevelFeatures - pure function; extracts box count, grid dimensions, and reachability complexity. No side effects.
- chooseAlgorithm(features): AlgorithmId - pure deterministic rule table:
  - boxCount <= 3  -> bfsPush
  - boxCount 4-6  -> astarPush (manhattan heuristic)
  - boxCount >= 7  -> astarPush (assignment heuristic)
  - (IDA* slots into the table later without changing the interface)
- Both functions are part of the packages/solver public API (exported from src/index.ts).
- Called on the main thread inside the startSolve thunk before SOLVE_START is dispatched. The protocol never carries an unresolved or 'auto' algorithmId.
- solverSlice stores recommendation: { algorithmId, features } when a level loads.
- Solver panel displays the recommendation (e.g. "Recommended: A* - 7 boxes") and allows user override.
- selectedAlgorithmId is recorded in SOLVE_RESULT metrics and in all stored benchmark results.
- Unit tests required for chooseAlgorithm covering every rule branch, and for analyzeLevel covering edge cases (0 boxes, max boxes, minimal grid).

====================================================================
5) WORKER REQUIREMENTS (VERSIONED PROTOCOL + VALIDATION)
====================================================================

Use module workers.
- In Remix, workers are client-only: create them only from `.client.ts` modules.
- No dynamic-import escape hatch is allowed for worker construction from server-reachable modules.
- Worker construction pattern:
  `new Worker(new URL("./solverWorker.ts", import.meta.url), { type: "module" })`

All worker messages MUST include:
- protocolVersion: 1
- runId: string

Worker protocol (minimum set):

Main -> Worker:
- SOLVE_START { runId, protocolVersion, levelRuntime, algorithmId, options }
  Note: algorithmId is always a concrete resolved ID (e.g. 'bfsPush', 'astarPush'). Resolution from level features via analyzeLevel/chooseAlgorithm happens on the main thread before dispatch. The protocol never carries 'auto' or any unresolved value.
- SOLVE_CANCEL { runId, protocolVersion }
- BENCH_START  { runId, protocolVersion, suite, options }
- PING { protocolVersion }

Worker -> Main:
- SOLVE_PROGRESS { runId, protocolVersion, expanded, frontier, depth, elapsedMs, bestHeuristic? }
- SOLVE_RESULT { runId, protocolVersion, status, solutionMoves?, metrics }
- SOLVE_ERROR { runId, protocolVersion, message, details? }
- BENCH_PROGRESS { ... }
- BENCH_RESULT { ... }
- PONG { protocolVersion }

Validation:
- Implement schemas centrally in packages/worker/protocol/schema.ts (e.g., Zod).
- Validate inbound messages on both sides (worker + client).
- Reject unknown fields / mismatched versions with a clear error.

Protocol validation posture:
- Define VALIDATE_PROTOCOL:
  - full in dev
  - control-plane in prod
- Require tests for both modes.

Progress throttling:
- Throttle progress posts to a reasonable rate (e.g., <= 10-20 msgs/sec).

Cancellation:
- Must cancel quickly and release resources; never leave UI hanging.

SharedArrayBuffer/Atomics:
- Do NOT use SharedArrayBuffer or Atomics. They require cross-origin isolation headers (COOP + COEP) which add deployment constraints. All coordination must go through postMessage and the versioned protocol.

====================================================================
6) WEB APP REQUIREMENTS (REMIX + TAILWIND + RTK)
====================================================================

Use:
- Remix + React + TypeScript
- TailwindCSS
- Redux Toolkit for state management
- React Testing Library for component tests

Package build model:
- `apps/web` is a Remix app in Vite mode.
- Remix consumes TypeScript source directly from workspace packages (no prebuild required for app runtime).
- tsc -b is used for typechecking only. No compiled JS dist output is required from domain packages.
- If declaration emit is enabled, emit declarations to dist-types/ only.
- Each package exposes a single public entrypoint at src/index.ts; package.json declares exports (and types only when declarations are emitted) to keep boundaries explicit.

Tailwind configuration:
- tailwind.config.ts content globs must include ../../packages/**/src/**/*.{ts,tsx} so classes used in package components are compiled.
- Design tokens live in apps/web/app/styles/tokens.css as CSS variables with a matching Tailwind theme extension. Tokens are the single source of truth; do not duplicate values in config or components.
- Dark mode: class-based (add/remove 'dark' on the html element, toggled by settingsSlice).

Routes/pages:
- /play (default)
- /bench
- /dev/ui-kit (design system primitives reference - no separate Storybook)
- Define routes with Remix route modules under apps/web/app/routes/.
- Keep route modules thin; route-specific selectors/thunks/controllers live in adjacent feature modules.
- Cross-cutting slices (game/solver/bench/settings) live in apps/web/app/state/.
- Every route exports a route-level ErrorBoundary so page crashes are contained and do not take down the whole app.

Initial Play page must mirror the existing UI shape:
- Side panel (level info, restart, win/fail, move history)
- Canvas container (board rendering + next level)
- Bottom controls (sequence input + send/apply)
Additionally add:
- Solver panel: shows algorithm recommendation from analyzeLevel/chooseAlgorithm (e.g. "Recommended: A* - 7 boxes"), allows override, run/cancel, progress, apply/animate solution, and Retry button when worker is crashed.

Canvas rendering:
- React owns layout; rendering is imperative in a renderer module.
- Do NOT re-render React on every animation frame; use RAF-based drawing with throttled state snapshots.
- Renderer is split into two layers:
  - buildRenderPlan(state): RenderPlan - pure function, no canvas dependency, fully unit-tested.
  - draw(ctx, plan): void - thin caller of ctx.drawImage/ctx.fillRect, not directly unit-tested.
  - RenderPlan is serializable and emitted in stable order (deterministic).
  - The RAF loop calls buildRenderPlan then draw. Only buildRenderPlan requires test coverage.

State slices (RTK):
- gameSlice: current level, GameState, history pointers, input mode
- solverSlice: active runs, progress, last solution, status, recommendation ({ algorithmId, features } from analyzeLevel), workerHealth ('idle' | 'healthy' | 'crashed')
- benchSlice: suites, active run status, results, filters
- settingsSlice: animation speed, theme, debug flags

Redux serializability strategy (required):
- Keep Redux state and actions JSON-serializable by default.
- Do not store typed arrays (`Uint8Array`, `Uint16Array`, etc.) directly in slices.
- Store serializable equivalents in Redux (`number[]`, ids, plain objects) and keep typed-array
  level/runtime caches outside Redux (for example, in level repositories/ports keyed by levelId).
- If a non-serializable value is ever unavoidable, explicitly scope RTK serializableCheck
  exceptions to known action types/paths and document the reason in code.

Worker failure recovery:
- solverClient listens to worker.onerror and worker.onmessageerror.
- On either event: set workerHealth to 'crashed' in solverSlice; surface "Solver crashed - retry" state in the solver panel.
- retryWorker thunk tears down the current worker client and recreates it cleanly, resetting workerHealth to 'idle'.
- Solver panel renders a Retry button when workerHealth === 'crashed'.
- Bench worker/pool health is tracked similarly and surfaced in benchSlice.

Side-effects:
- Use thunks for starting/cancelling solver runs and benchmark runs.
- Use a SolverPort/BenchmarkPort abstraction injected into store creation so UI doesn't call Worker directly.
- startSolve thunk calls analyzeLevel + chooseAlgorithm, stores recommendation in solverSlice, then dispatches SOLVE_START with the resolved algorithmId.
- Async failures in thunks/ports are converted to typed slice errors (no uncaught promise paths in UI components).

Design system primitives (minimal, Tailwind-based):
- Button, IconButton
- Input, Select
- Tabs
- Dialog (for import/export or advanced options)
- Tooltip
Keep them accessible: keyboard focus states, ARIA where applicable.
Validate primitives via the /dev/ui-kit route. No separate Storybook.

====================================================================
7) BENCHMARK PAGE REQUIREMENTS
====================================================================

Benchmark model:
- BenchmarkSuite: levelIds[], algorithmConfigs[], repetitions, budgets (time/node)
- Results captured with environment metadata (UA, cores, build version)

Execution:
- Run benchmarks in worker pool; default pool size: max(1, min(4, (navigator.hardwareConcurrency || 4) - 1)).
- Warm-up: opt-in toggle in suite builder, default off. When enabled, warm-up iterations run first and their results are discarded; only timed runs are stored. The warm-up setting is recorded per result for comparability.
- Each stored result includes the full solver options used (algorithmId, heuristic, budgets) so runs are strictly comparable.
- Persist results locally using IndexedDB via an adapter (do not access persistence directly from UI components).
- IndexedDB schema: define DB_VERSION constant in packages/benchmarks; migration logic (onupgradeneeded) lives in apps/web/app persistence adapter with unit tests covering version upgrades. Retention: cap at 100 stored runs (configurable); provide "Clear storage" action in bench settings.
- Compression is deferred.
- Call navigator.storage.persist() on adapter init (feature-detected); record the result in bench diagnostics and log only in dev/debug mode.
- Instrument with performance.mark/measure around solve dispatch, worker response, and result write; surface via PerformanceObserver in a debug/perf panel.

UI:
- suite builder (levels, algorithms, budgets)
- run/cancel
- results table (sortable; virtualize if large)
- export/import JSON for benchmark runs and level packs (File System Access API with fallback to anchor-download)
- perf panel (visible when debug flag is set): shows PerformanceObserver entries for solver and bench timing

====================================================================
8) TESTING, LINTING, CI SCRIPTS (MUST BE INCLUDED)
====================================================================

Add/ensure these root scripts (pnpm):
- pnpm lint
- pnpm typecheck (tsc -b)
- pnpm test (unit)
- pnpm test:coverage (enforced thresholds)
- pnpm dev
- pnpm build

Vitest coverage thresholds must enforce:
- >= 95% globally
- (prefer stricter for core/solver; configure per package if practical)

Formatting policy:
- Prettier owns all formatting rules. ESLint owns correctness and best practices only.
- Use eslint-config-prettier to disable all ESLint rules that overlap with Prettier.
- Do NOT add @stylistic/eslint-plugin or any other ESLint formatting rules. This is non-negotiable.

CI gate (required on every PR):
- pnpm typecheck
- pnpm lint
- pnpm test:coverage (enforced thresholds)
- boundary checks (eslint-plugin-boundaries + no-restricted-imports/no-restricted-syntax pass)
- encoding policy check (UTF-8 without BOM, ASCII-default text, no smart punctuation unless justified)

Pre-commit hooks:
- pnpm lint
- unit tests for affected packages
- affected-test strategy must be explicit and deterministic (for example, changed workspace filter using pnpm --filter)
- encoding policy check (UTF-8 without BOM, ASCII-default text, no smart punctuation unless justified)

CONTRIBUTING.md (required at repo root):
- How to run tests locally
- How to add a new solver algorithm (registry entry, unit tests, worker message support)
- How to add a new benchmark metric safely
- Formatting and lint rules summary (Prettier owns formatting, ESLint owns correctness)

Testing requirements:
- core: movement rules, push rules, win detection, undo/restart, parsing/encoding, constraint enforcement (rejects grids exceeding MAX_GRID_WIDTH etc.)
- solver: reachability basics, corner deadlock rule, BFS solves small level(s), cancellation behavior (deterministic), chooseAlgorithm covering every rule branch, analyzeLevel covering edge cases (0 boxes, max boxes, minimal grid)
- worker: protocol schema validation, cancellation path, throttled progress (deterministic simulation), workerHealth transitions on onerror/onmessageerror
- web: key component behaviors (dispatches, renders state), keyboard input handler, buildRenderPlan output correctness for known states

Avoid sleep-based tests; use fake timers for playback.

====================================================================
9) DOCUMENTATION DELIVERABLES
====================================================================

Multi-LLM instruction routing:
- LLM_GUIDE.md at the repo root is the canonical, vendor-neutral authority for all engineering and collaboration rules.
- AGENTS.md and CLAUDE.md at the repo root are short wrappers that point to LLM_GUIDE.md.
- If any instruction conflicts between a wrapper and LLM_GUIDE.md, LLM_GUIDE.md wins.
- Optional additional wrappers: .github/copilot-instructions.md, .cursor/rules/* - same rule applies.

Other documentation:
- Ensure /docs/Architecture.md exists and matches the decisions above.
- Ensure /docs/project-plan.md exists and defines phases, acceptance criteria, and execution standards.
- Ensure /docs/dev-tools-spec.md exists and defines boundary/tooling implementation details.
- Ensure /docs/Engineering-Process-Playbook.md exists and defines process/governance flow.
- Ensure root /LLM_GUIDE.md exists as canonical and root /AGENTS.md and /CLAUDE.md exist as short wrappers pointing to it.
- Add short package READMEs where useful (core/solver/worker/web) describing public APIs and boundaries.
- Add ADRs only when introducing new cross-cutting patterns beyond what's specified here.

Keep docs short and current.

====================================================================
10) IMPLEMENTATION PLAN (DO THIS IN ORDER)
====================================================================

Phase 0 - Scaffold and enforcement
Decision dependencies: ADR-0001 (Remix-first app shell) and ADR-0002 (monorepo boundaries).
1) Create pnpm workspace + root configs (tsconfig base, eslint with eslint-config-prettier, prettier) and scaffold `apps/web` as Remix in Vite mode
2) Create package folders with public entrypoints (src/index.ts), TS project refs, package.json exports, and optional types fields only when declaration emit is enabled
3) Add lint/typecheck/test scripts and make them pass
4) Add pre-commit hooks (pnpm lint + affected package tests)
5) Add CONTRIBUTING.md: run-tests, add-algorithm, add-metric, formatting rules
6) Add root LLM_GUIDE.md canonical + AGENTS.md / CLAUDE.md wrappers

Phase 0 Integration Proofs
- Workspace TS-source imports work in Remix Vite dev and build.
- SSR bundling is correct; document whether `ssr.noExternal` is required and for which packages.
- Vite dev server can access workspace package sources; document whether `server.fs.allow` is needed.
- Vitest runs without loading the Remix plugin, or uses a separate Vite config.

Phase 1 - Levels + Core engine
1) Add packages/shared/src/constraints.ts with MAX_GRID_WIDTH, MAX_GRID_HEIGHT, MAX_BOXES, MAX_BENCH_SUITE_LEVELS, MAX_IMPORT_BYTES
2) Port levels into packages/levels (preserve minified rows compatibility); verify and re-encode any knownSolution strings to UDLR
3) Implement core model + engine functions with high unit coverage; enforce constraint limits in parseLevel
4) Add hashing utilities for solver use

Phase 2 - Web UI parity (Play page)
Decision dependencies: ADR-0001 (app shell) and ADR-0005 (RenderPlan split).
1) Remix app (`apps/web`, Vite mode) + Tailwind layout; configure content globs for workspace packages; set up tokens.css and dark mode class strategy
2) Remix route modules for /play, /bench, /dev/ui-kit with route-level ErrorBoundary exports
3) RTK store + gameSlice
4) Canvas renderer split: buildRenderPlan(state): RenderPlan (pure, tested) + draw(ctx, plan): void (thin, untested); RAF loop; keyboard input + move history + restart + undo + next level
5) Sequence input applies moves deterministically
6) Add /dev/ui-kit route rendering all design system primitives

Phase 3 - Worker + baseline solver
Decision dependencies: ADR-0003 (worker protocol) and ADR-0004 (push-based solver model).
1) Implement protocol schemas + runtime validation
2) Implement solver BFS push-based with cancel token + throttled progress hooks
3) Implement analyzeLevel + chooseAlgorithm in packages/solver/api/selection.ts with unit tests for every rule branch and edge case
4) Implement module worker runtime and client wrapper; add worker.onerror / worker.onmessageerror handling and workerHealth tracking
5) Add solverSlice (recommendation + workerHealth fields) + UI panel: show recommendation, run/cancel, progress, apply/animate solution, retry crashed worker

Phase 4 - Benchmark page
Decision dependency: ADR-0007 (IndexedDB model, migration policy, retention).
1) Benchmark models + runner in packages/benchmarks; define DB_VERSION and IndexedDB schema; add migration tests covering version upgrades
2) Worker pool for benchmark runs: max(1, min(4, (navigator.hardwareConcurrency || 4) - 1))
3) Bench page UI with suite builder + results + persistence adapter (IndexedDB)
4) Call navigator.storage.persist() on adapter init when feature-detected; record outcome in bench diagnostics and log only in dev/debug
5) Add performance.mark/measure instrumentation around solve dispatch and worker response; wire PerformanceObserver to debug perf panel in benchSlice
6) File System Access API export/import for benchmark reports and level packs (anchor-download fallback)

Phase 5 - Quality and offline
1) Add/raise coverage gates to >=95%
2) Add boundary lint rules and ensure no violations
3) Add minimal Playwright smoke test (play a level, run a bench, verify IndexedDB persistence)
4) Add PWA: service worker/Workbox integration compatible with Remix hosting; verify app loads without network

Phase 6 - Adapters, tooling, and performance
Decision dependency: ADR-0006 (embed Shadow DOM and styling delivery strategy).
1) Level Lab page (/lab): level editor (text input for row encoding) + preview/play area + one-click solver/bench run + export/import JSON
2) Embed adapter (`packages/embed`): `<corgiban-embed>` custom element mounting a minimal React subtree with Shadow DOM + scoped stylesheet injection. Bundle React as a dependency (not peer). Follow ADR-0006 lifecycle/cleanup constraints and add integration tests covering attribute changes, DOM events, and unmount
3) OffscreenCanvas: move sprite pre-rendering into a worker using OffscreenCanvas; keep main-thread renderer as fallback for browsers that don't support it
4) WASM kernels (`packages/solver-kernels`): implement reachability flood fill, state hashing, and assignment heuristic in TS first; promote bottlenecks to Rust + `wasm-pack` kernels loaded lazily in workers (`instantiateStreaming` + fallback)

Phase 7 - Optional browser-dev adapters
1) Add Sandpack/WebContainers integration for `/lab` Dev Tools only:
   - loaded via dynamic import
   - gated behind an explicit feature flag (default OFF)
   - not required for normal play/solve/bench product flows

====================================================================
11) ACCEPTANCE CRITERIA (REQUIRED)
====================================================================

- `pnpm typecheck` passes (tsc project references)
- `pnpm lint` passes
- `pnpm test:coverage` passes with enforced thresholds (>=95% overall)
- `pnpm dev` runs:
  - /play supports keyboard moves, restart, undo, move history
  - /play solver panel shows algorithm recommendation (e.g. "Recommended: A* - 7 boxes") and allows override
  - /play solver panel can start/cancel a solve; progress updates; result can be applied/animated
  - /play solver panel shows Retry button when worker is crashed; clicking it recreates the worker
  - /bench route loads and can run a small benchmark suite; results persist in IndexedDB across page reloads
  - /bench export produces a valid JSON file; import round-trips correctly
  - navigator.storage.persist() is requested on adapter init when supported; outcome is stored in bench diagnostics (console logging only in dev/debug)
  - performance.mark/measure entries are visible in the browser DevTools Performance panel during a solve or bench run
  - /dev/ui-kit route renders all design system primitives
- `pnpm build` produces a PWA: app shell loads without a network connection after first visit (Workbox service worker active)

====================================================================
12) EXECUTION AND REPORTING STANDARDS
====================================================================

Before implementation:
- Print the proposed file tree and a short checklist of steps you will implement.

During implementation:
- Keep commits logically grouped (if your workflow supports it) or keep changes well-organized.

After implementation:
- List the commands to run and what they should output (high-level).
- Call out any deliberate tradeoffs or deferred items (short).

