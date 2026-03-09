# Corgiban Project Plan

This document defines the implementation constraints, architecture, and phased delivery plan for Corgiban.
It preserves the same technical requirements as the prior prompt-form version, expressed as a project plan.

# ==================================================================== 0) GLOBAL RULES (NON-NEGOTIABLE)

A) Determinism and purity

- Game engine and solver logic must be deterministic and side-effect free.
- No DOM/Web APIs in domain packages (core/solver). React imports are allowed only in adapter
  surfaces (`apps/web` and `packages/embed`).

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

1. # TARGET END-STATE ARCHITECTURE (DECISIONS ARE ALREADY MADE)

Use a pnpm workspaces monorepo with this structure:

/apps
/web
/app
/ui
/canvas
buildRenderPlan.ts
renderPlan.ts
draw.ts
GameCanvas.tsx
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
vite.config.ts (Remix in Vite mode)
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
/formats
src/
index.ts
parseXsb.ts
parseSok017.ts
parseSlcXml.ts
serializeXsb.ts
normalizeGrid.ts
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
applyMoves.ts
selectCellAt.ts
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
solverOptions.ts
solverConstants.ts
algorithm.ts
registry.ts
selection.ts
solve.ts
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
validation.ts
runtime/
benchmarkWorker.ts
solverWorker.ts
client/
benchmarkClient.client.ts
solverClient.client.ts
workerPool.client.ts
/benchmarks
src/
model/
benchmarkSchema.ts
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

Note: This structure includes planned files/modules that may not exist yet. Check the repo tree
for what is implemented in the current phase.

====================================================================
1B) PRODUCT-ALIGNED TECHNOLOGY PLACEMENTS (BOUNDED ADAPTERS)
====================================================================

Principle: Each technology must be a well-bounded adapter. Do not let these dependencies leak into core/solver.

Summary table:

| Tech                                              | Placement in Corgiban                                                                                                                           | Product value                                                                    | Cost / risk                                                                                   | Recommendation                                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Web Workers                                       | Solver runs; benchmark runner; optional worker pool                                                                                             | Keeps UI responsive; enables concurrency; makes benchmarks practical             | Requires protocol discipline + cancellation                                                   | Core requirement                                                                                |
| Web Components                                    | `packages/embed` exporting `<corgiban-embed>` with Shadow DOM + scoped stylesheet injection                                                     | Embeddable play surface that resists host CSS collisions                         | Requires isolated style artifact + lifecycle integration tests                                | Implemented in Phase 6                                                                          |
| Remix                                             | `apps/web` primary app shell from Phase 0                                                                                                       | SSR/streaming + server actions + routing in one framework                        | Requires Remix conventions from day one                                                       | Core requirement (Phase 0)                                                                      |
| Browser dev environments (WebContainers/Sandpack) | Level Lab `/lab` route; browser-dev workspace added later behind a "Dev Tools" section                                                          | Shareable repro workflows, editable examples, and in-browser experimentation     | Heavy dependency, browser support variance, and workspace/template upkeep                     | Level Lab implemented; browser-dev workspace: Phase 10                                          |
| WebAssembly                                       | `packages/solver-kernels` for hot loops; TS interface first, Rust + `wasm-pack` when promoted                                                   | Optional acceleration path for large suites                                      | Toolchain/debug overhead + binary loading strategy complexity                                 | TS baseline implemented; delivery/preload groundwork landed; runtime integration post-profiling |
| Advanced browser APIs                             | IndexedDB, File System Access, PerformanceObserver + performance.mark/measure, navigator.storage.persist(), PWA/service worker, OffscreenCanvas | Durability, sharing, perf visibility, offline use, reduced main-thread rendering | Some APIs need fallbacks; cross-origin isolation only needed for SharedArrayBuffer (avoid it) | Phase 4-6; all six listed APIs are in scope                                                     |

Concrete placements:

1. Web Workers (must-have): worker pool for benchmarks capped at navigator.hardwareConcurrency; solver-owned progress cadence with worker-requested cadence fields; deterministic cancellation. Do NOT use SharedArrayBuffer/Atomics - postMessage protocol only (avoids COOP/COEP deployment constraints).
2. Web Components (Phase 6): `packages/embed` with `<corgiban-embed>` attributes (level-id, level-data, readonly, show-solver, theme) and DOM events (corgiban:error, corgiban:solved, corgiban:move, corgiban:benchmarkComplete). Embed level resolution is precedence-based: a known built-in `level-id` wins, `level-data` is used only when the id is missing or unknown, and unresolved inputs surface an explicit invalid state. Default to Shadow DOM with scoped stylesheet injection. Bundle React as a dependency (not a peer dependency) so the embed remains self-contained on any host page.
3. Remix (Phase 0 baseline): `apps/web` is a Remix app from the start. Use Remix routing/data APIs as the primary app model while keeping domain packages unchanged and framework-agnostic.
4. Level Lab (Phase 6): `/lab` route with level editor + preview, run solver/bench, export/import JSON. Add Sandpack/WebContainers integration later (Phase 10) behind a "Dev Tools" section via dynamic import and a feature flag; keep it `/lab`-only, use it for reproducible examples and repro packs, and do not require it for normal product usage.
5. WASM kernels (Phase 6, post-profiling): implement TS version first behind the same interface; promote only benchmark-proven hotspots to Rust + `wasm-pack`. Load WASM lazily inside workers via `fetch` + `WebAssembly.instantiateStreaming` (fallback to `WebAssembly.instantiate`). `apps/web` owns optional kernel URL wiring for worker bootstraps; workers preload best-effort and must retain the TS baseline as fallback. Phase 6 delivers the TS kernels plus delivery/preload groundwork; solve and bench execution still use the TS solver path until a later runtime-integration phase proves a measurable benefit. Candidates: reachability flood fill, state hashing, assignment heuristic, bitset operations.
6. Advanced APIs (Phase 4-6): IndexedDB (benchmark persistence via adapter) + File System Access API (export/import level packs and benchmark reports) + PerformanceObserver + performance.mark/measure (solver latency and render timing) + navigator.storage.persist() (durable IndexedDB on first benchmark run) + PWA/service worker (offline caching) + OffscreenCanvas (worker-side sprite pre-rendering, Phase 6). Do not use SharedArrayBuffer.

Support + fallback matrix (minimum):

| Capability             | Expected support posture                          | Primary path                                                   | Fallback path                                                         |
| ---------------------- | ------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| File System Access API | Chromium-first; not universal                     | Native open/save dialogs for level packs and benchmark exports | File input + anchor-download (`Blob`/`URL.createObjectURL`)           |
| OffscreenCanvas        | Not universal across browsers/contexts            | Worker-side pre-rendering/asset prep where supported           | Main-thread Canvas renderer (`buildRenderPlan` + `draw`)              |
| PWA Service Worker     | Varies by host/protocol and embedding constraints | Workbox app-shell/offline caching on supported HTTPS hosts     | No-SW network mode; app remains functional without offline guarantees |

# ==================================================================== 2) HARD PACKAGE BOUNDARIES (ENFORCE WITH TS + ESLINT)

- packages/core imports ONLY: packages/shared, packages/levels
- packages/formats imports ONLY: packages/shared, packages/levels
- packages/solver imports ONLY: packages/core, packages/shared
- packages/solver-kernels imports ONLY: packages/solver, packages/core, packages/shared
- packages/worker imports ONLY: packages/solver, packages/solver-kernels, packages/core, packages/shared, packages/benchmarks
- packages/benchmarks imports ONLY: packages/solver, packages/core, packages/shared
- apps/web imports packages ONLY through their public entrypoints (package root exports)
- packages/embed is an adapter package; it may import React and package public
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
  Run on-demand via pnpm exec depcruise --config dependency-cruiser.config.mjs packages/ apps/.

# ==================================================================== 3) DOMAIN MODEL AND ENGINE REQUIREMENTS

Levels use a static+dynamic split:

- staticGrid: walls + targets (immutable)
- dynamicState: player position + box positions

Level data should remain editor-friendly and compatible with minified string rows from the existing implementation:

- LevelDefinition: { id, name, rows: string[], knownSolution?: string | null, ... }
  - knownSolution allows only UDLR/udlr, preserves case (lowercase = move, uppercase = push)
  - null = no usable known solution (absent, empty, or failed validation)
  - undefined = field not present in source pre-normalization only
- LevelCollection: { id, title, levels: LevelDefinition[], ... } with collection metadata
- Compile to LevelRuntime: { levelId, width, height, staticGrid, initialPlayerIndex, initialBoxes }
  - initialBoxes uses Uint32Array in LevelRuntime; solver internal state nodes may use Uint16Array for memory efficiency.

Core engine API (pure):

- createGame(levelRuntime): GameState
- applyMove(state, direction): { state: GameState, changed: boolean, pushed: boolean }
- applyMoves(state, directions, options?): { state: GameState, changed: boolean, stoppedAt?: number }
- undo(state): GameState
- restart(state): GameState
- isWin(state): boolean
- selectCellAt(levelOrState, index): { wall: boolean, target: boolean, box: boolean, player: boolean }
- (optional) getLegalMoves(state): Direction[]

GameState is deterministic. In the core package it contains:

- level: LevelRuntime
- playerIndex
- boxes (sorted Uint32Array)
- history stack with minimal diffs for undo
- stats (moves, pushes)

Redux-facing state remains JSON-serializable (levelId plus plain arrays/objects) and keeps typed arrays out of slices.

Invariants must be validated in tests:

- player not on wall
- player does not overlap a box
- boxes do not overlap
- boxes not on walls

Move string contract:

- Canonical direction encoding defined once in packages/shared/src/types.ts:
  export type Direction = 'U' | 'D' | 'L' | 'R'; // U=up D=down L=left R=right
- Engine move strings, solver output, and sequence inputs use uppercase UDLR only.
- knownSolution may be mixed-case UDLR/udlr; preserve case for push markers.
- When porting legacy levels, verify knownSolution uses only UDLR/udlr, strip whitespace,
  and preserve case (invalid values become null).
- Built-in knownSolution strings are legacy direction-only uppercase; push-marker conversion
  is deferred until formats import/export work is implemented.

Validation constraints (packages/shared/src/constraints.ts):

- MAX_GRID_WIDTH = 64, MAX_GRID_HEIGHT = 64
- MAX_BOXES = 40
- MAX_BENCH_SUITE_LEVELS = 200
- MAX_IMPORT_BYTES = 1_048_576 (1 MB)
  Both packages/core (parseLevel) and the import parser enforce these using the same constants.
  No separate solver limits. Reject malformed rows at parse time with a descriptive error message.
  Imported JSON is size-checked before JSON.parse, then strict-schema validated after parse
  (unknown keys rejected).

Format interop (packages/formats):

- CORG stays canonical; core/encoding handles CORG only.
- formats package handles XSB/SOK/SLC import/export and emits LevelDefinition/LevelCollection.
- Documented SOK subset support (pre-board title/comment metadata, positive-count RLE, and row
  separators).
- Import normalization rules:
  - Never trim rows; ragged rows allowed (pad to max width with floor).
  - Support interior empty rows via two-pass normalization.
  - Accept floor aliases `-` and `_` only in converters.
  - Reject tabs by default; never store tabs internally.
  - Use topology-aware crop (outside-void flood fill), not naive common-indent stripping.
  - Detect open/unclosed puzzles; reject by default with explicit override policies only.
  - Closed-puzzle validation yields warnings by default; strict mode optional.
  - Reject levels with all boxes on targets at start.
  - Detect unsupported variants (numbered, multiban, hexoban, modern) and reject by default
    with optional metadata carry.

# ==================================================================== 4) SOLVER REQUIREMENTS

Solver action model MUST be push-based:

- Search graph edges are box pushes; between pushes compute player reachability.
- Return solution as move string for playback (expand macro pushes to UDLR steps).
  - expandSolutionFromStart(levelRuntime, pushes) returns the full UDLR walk+push sequence.
  - expandSolution(levelRuntime, pushes, start) expands from an explicit start state when needed.
  - Push = { boxIndex, direction } where boxIndex is the box position before the push.
  - Walk-path reconstruction uses BFS from the player position to the push-entry cell,
    expanding neighbors in canonical order U, D, L, R (same order as reachability).

Baseline algorithms (start with one, structure for many):

- BFS push-based (minimum viable)
- A\* push-based (optional in first pass if time; keep interface ready)
- IDA\* (optional later; stub/placeholder acceptable)

Solver API:

- solve(levelRuntime, options, hooks) -> SolveResult
- deterministic given same inputs
- cooperative cancellation via CancelToken (checked every N expansions)
- progress callbacks are throttled and stable

SolverOptions (packages/solver/api/solverTypes.ts):

- timeBudgetMs?: number (if provided, > 0)
- nodeBudget?: number (if provided, > 0)
- heuristicId?: 'manhattan' | 'assignment' (rejected for bfsPush)
- heuristicWeight?: number (1.0-10.0; > 1.0 enables Weighted A\*)
- enableSpectatorStream?: boolean (when true, SOLVE_PROGRESS may include bestPathSoFar)

Defaults and validation:

- heuristicWeight outside [1.0, 10.0] is rejected.
- heuristicId defaults to 'manhattan' for astarPush and idaStarPush.
- heuristicWeight defaults to 1.0 for astarPush and idaStarPush.

Add at least one deadlock pruning rule early:

- corner deadlocks (box in a corner not on target)

Heuristics:

- Manhattan sum baseline
- keep assignment heuristic as optional module (can be stubbed initially, but scaffold the interface)

Algorithm selection (packages/solver/api/selection.ts):

- analyzeLevel(levelRuntime): LevelFeatures - pure function; extracts box count, grid dimensions, and reachability complexity. No side effects.
- chooseAlgorithm(features): AlgorithmId - pure deterministic rule table:
  - boxCount <= 3 -> bfsPush
  - boxCount 4-6 -> astarPush (manhattan heuristic)
  - boxCount >= 7 -> astarPush (assignment heuristic)
  - (IDA\* slots into the table later without changing the interface)
- The selector must only return runnable ids. If a preferred id is not implemented yet, it must
  fall back to `DEFAULT_ALGORITHM_ID` (Phase 3 baseline: `bfsPush`).
- Both functions are part of the packages/solver public API (exported from src/index.ts).
- Called on the main thread inside the startSolve thunk before SOLVE_START is dispatched. The protocol never carries an unresolved or 'auto' algorithmId.
- solverSlice stores recommendation: { algorithmId, features } when a level loads.
- Solver panel displays the recommendation (for example, "Recommended: bfsPush (7 boxes)") and
  allows user override.
- selectedAlgorithmId is recorded in app-side run metadata and in all stored benchmark results.
- Unit tests required for chooseAlgorithm covering every rule branch, and for analyzeLevel covering edge cases (0 boxes, max boxes, minimal grid).

# ==================================================================== 5) WORKER REQUIREMENTS (VERSIONED PROTOCOL + VALIDATION)

Use module workers.

- In Remix, workers are client-only: create them only from `.client.ts` modules.
- No dynamic-import escape hatch is allowed for worker construction from server-reachable modules.
- Worker construction pattern:
  - package-internal default:
    `new Worker(new URL("../runtime/solverWorker.ts", import.meta.url), { type: "module" })`
  - app adapter url import (Remix/Vite):
    `import solverWorkerUrl from "./solverWorker.client.ts?worker&url";`
    `new Worker(solverWorkerUrl, { type: "module", name: "corgiban-solver" })`
    `import benchmarkWorkerUrl from "./benchmarkWorker.client.ts?worker&url";`
    `new Worker(benchmarkWorkerUrl, { type: "module", name: "corgiban-benchmark" })`

All run-scoped worker messages MUST include:

- protocolVersion: 2
- runId: string

Worker lifecycle messages (PING/PONG) include protocolVersion only.

Worker protocol (minimum set):

Main -> Worker (implemented in protocol v2 baseline):

- SOLVE_START { runId, protocolVersion, levelRuntime, algorithmId, options }
  Note: algorithmId is always a concrete resolved ID (e.g. 'bfsPush', 'astarPush'). Resolution from level features via analyzeLevel/chooseAlgorithm happens on the main thread before dispatch. The protocol never carries 'auto' or any unresolved value.
- BENCH_START { runId, protocolVersion, levelRuntime, algorithmId, options, benchmarkCaseId? }
- PING { protocolVersion }

Main -> Worker (planned protocol extension):

- SOLVE_CANCEL { runId, protocolVersion }
- BENCH_CANCEL { runId, protocolVersion }

Worker -> Main (implemented in protocol v2 baseline):

- SOLVE_PROGRESS { runId, protocolVersion, expanded, frontier, depth, elapsedMs, bestHeuristic?, bestPathSoFar? }
  - bestPathSoFar (when present) is a fully expanded UDLR walk+push string.
- SOLVE_RESULT { runId, protocolVersion, status, solutionMoves?, metrics, errorMessage?, errorDetails? }
  - metrics: elapsedMs, expanded, generated, maxDepth, maxFrontier, pushCount, moveCount
- SOLVE_ERROR { runId, protocolVersion, message, details? }
- PONG { protocolVersion }
- BENCH_PROGRESS { runId, protocolVersion, expanded, generated, frontier, depth, elapsedMs, bestHeuristic?, bestPathSoFar?, benchmarkCaseId? }
  - emitted only when `enableSpectatorStream` is enabled for that run
- BENCH_RESULT { runId, protocolVersion, status, solutionMoves?, metrics, errorMessage?, errorDetails?, benchmarkCaseId? }

Validation:

- Implement schemas centrally in packages/worker/protocol/schema.ts (e.g., Zod).
- Validate inbound messages on both sides (worker + client).
- Reject unknown fields / mismatched versions with a clear error.

Protocol validation posture:

- Phase 3 baseline validates full inbound/outbound protocol messages in all builds.
- Phase 4 adds an optional `light-progress` path for outbound `SOLVE_PROGRESS` validation only;
  strict mode remains the default and structural messages remain strict.
- Any further reduced validation mode must be gated behind explicit config with tests for each mode.

Progress throttling:

- Solver owns progress cadence; worker runtimes request cadence through
  `progressThrottleMs` / `progressExpandedInterval` instead of applying a second throttle layer.
- Keep emitted progress at a reasonable rate (for example <= 10-20 msgs/sec) for interactive
  surfaces; benchmark worker progress remains spectator-only.

Cancellation:

- Must cancel quickly and release resources; never leave UI hanging.

Concurrency model:

- Phase 3 `/play` orchestration is single-active-run per `SolverClient` instance.
- For concurrency, use `WorkerPool` (distinct runIds, one active run per worker, queued overflow).
- The worker pool assigns one active run per worker and queues additional runs.
- The worker pool supports cancelling queued runs by runId before they dispatch.
- In-flight cancellation in Phase 3 uses solver-client worker reset (terminate + recreate);
  queue cancellation remains runId-based.
- Worker pool dispose drains queued runs and rejects their promises.
- Benchmark suite cancellation uses pool disposal plus generation-guarded callback dispatch to
  ignore stale progress/results after cancel/dispose.

SharedArrayBuffer/Atomics:

- Do NOT use SharedArrayBuffer or Atomics. They require cross-origin isolation headers (COOP + COEP) which add deployment constraints. All coordination must go through postMessage and the versioned protocol.

# ==================================================================== 6) WEB APP REQUIREMENTS (REMIX + TAILWIND + RTK)

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

- tailwind.config.ts content globs must include ../../packages/**/src/**/\*.{ts,tsx} so classes used in package components are compiled.
- Design tokens live in apps/web/app/styles/tokens.css as CSS variables with a matching Tailwind theme extension. Tokens are the single source of truth; do not duplicate values in config or components.
- Dark mode: class-based; the root app shell resolves and toggles the `<html>` theme class, persists explicit user choice in browser storage, and falls back to `prefers-color-scheme` on first visit.

Routes/pages:

- /
- /play
- /bench
- /lab
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
- Solver panel: shows algorithm recommendation from analyzeLevel/chooseAlgorithm (for example,
  "Recommended: bfsPush (7 boxes)"), allows override, run/cancel, progress, apply/animate
  solution, and Retry button when worker is crashed.

Canvas rendering:

- React owns layout; rendering is imperative in a renderer module.
- Do NOT re-render React on every animation frame.
- Renderer is split into two layers:
  - buildRenderPlan(state): RenderPlan - pure function, no canvas dependency, fully unit-tested.
  - draw(ctx, plan): void - thin caller of ctx.drawImage/ctx.fillRect, not directly unit-tested.
  - RenderPlan is serializable and emitted in stable order (deterministic).
  - Draw on state or size changes; reserve RAF for replay/animation flows. Only buildRenderPlan
    requires direct unit-test coverage.

Replay pipeline:

- solutionMoves string arrives in SOLVE_RESULT as a fully expanded UDLR string.
- Parse into Direction[] and store in the replay controller's shadow state (not Redux).
- Replay scheduler uses a RAF loop with a time accumulator (not setInterval).
- Each replay tick applies one move to a shadow GameState held outside Redux (useRef in the replay controller).
- Replay controller dispatches replayIndex updates; Redux never stores typed arrays.
- When replay finishes, user can apply the solution to gameSlice or dismiss it.
- Playback controls: Play/Pause, Step Back, Step Forward, Speed selector, and progress indicator.

State slices (RTK):

- gameSlice: current level id, move history (direction + pushed), stats (moves/pushes); GameState is derived outside Redux
- solverSlice: activeRunId, selectedAlgorithmId, latest progress snapshot, last result, status,
  recommendation ({ algorithmId, features } from analyzeLevel), workerHealth ('idle' | 'healthy'
  | 'crashed'), replayState, replayIndex, replayTotalSteps
- benchSlice: suite config, active run status/progress, persisted results, diagnostics, and perf entries
- settingsSlice: tileAnimationDuration, solverReplaySpeed, solver budget defaults (time/node), debug flags

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
- Benchmark run failures/cancellations are surfaced through bench status + diagnostics state.

Side-effects:

- Use thunks for starting/cancelling solver runs and benchmark runs.
- Store wiring injects `SolverPort`, `BenchmarkPort`, and `PersistencePort` at creation.
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

# ==================================================================== 7) BENCHMARK PAGE REQUIREMENTS

Benchmark model:

- BenchmarkSuite (app): levelIds[], algorithmIds[], repetitions, warmupRepetitions, budgets (time/node)
- Results captured with environment metadata (UA, cores, build version)

Execution:

- Run benchmarks in worker pool; default pool size: max(1, min(4, (navigator.hardwareConcurrency || 4) - 1)).
- Warm-up controls are available in `/bench` (`warmupRepetitions`). Warm-up runs execute before measured runs and are excluded from stored measured-result history.
- Each stored result includes the full solver options used (algorithmId, heuristic, budgets) so runs are strictly comparable.
- Persist results locally using IndexedDB via an adapter (do not access persistence directly from UI components).
- IndexedDB schema: define `BENCHMARK_DB_VERSION` and schema constants in packages/benchmarks; migration logic (onupgradeneeded) lives in apps/web/app persistence adapter with unit tests covering version upgrades. Retention: cap at 100 stored runs (configurable); provide "Clear storage" action in bench settings.
- Compression is deferred.
- Call navigator.storage.persist() on adapter init (feature-detected); record the result in bench diagnostics and log only in dev/debug mode.
- Instrument with performance.mark/measure around solve dispatch and worker response; surface via PerformanceObserver in a debug/perf panel.

UI:

- suite builder (levels, algorithms, repetitions, warmupRepetitions, budgets)
- run/cancel
- diagnostics panel for status/progress/persistence outcome/errors
- results table (sortable; virtualize if large)
- analytics/comparison panel (success rate, p50/p95 elapsed time, baseline deltas)
- export/import JSON for benchmark runs and level packs (File System Access API with fallback to anchor-download)
- comparison snapshot export for strictly comparable suites
- Benchmark report export semantics (Phase 4 baseline): export retained benchmark history with explicit `type`, `version`, and `exportModel` (`multi-suite-history`) plus strict run-record `results`.
- Benchmark report schema policy: accept only explicitly supported `type`/`version`/`exportModel` combinations; reject unsupported versions/models and invalid records with user-visible errors. Record validation must enforce required solver options and enum-like fields for comparability.
- Level-pack import contract: require `type` + `version`, accept level references via `levelIds[]` or `levels[].id`, and filter to known built-in ids with explicit errors for unsupported payloads.
- perf panel (visible when debug flag is set): shows PerformanceObserver entries for solver and bench timing

# ==================================================================== 8) TESTING, LINTING, CI SCRIPTS (MUST BE INCLUDED)

Add/ensure these root scripts (pnpm):

- pnpm lint
- pnpm typecheck (tsc -b)
- pnpm test (unit)
- pnpm test:coverage (enforced thresholds)
- pnpm test:smoke (Playwright route/persistence/offline smoke)
- pnpm dev
- pnpm build

Vitest coverage thresholds must enforce:

- > = 95% globally
- (prefer stricter for core/solver; configure per package if practical)

Formatting policy:

- Prettier owns all formatting rules. ESLint owns correctness and best practices only.
- Use eslint-config-prettier to disable all ESLint rules that overlap with Prettier.
- Do NOT add @stylistic/eslint-plugin or any other ESLint formatting rules. This is non-negotiable.

CI gate (required on every PR):

- pnpm format:check
- pnpm typecheck
- pnpm lint
- pnpm test:coverage (enforced thresholds)
- pnpm test:smoke (production preview path)
- boundary checks (eslint-plugin-boundaries + no-restricted-imports/no-restricted-syntax pass)
- encoding policy check (UTF-8 without BOM, ASCII-only text except allow list, no smart punctuation unless allowlisted)

Pre-commit hooks:

- pnpm format:check
- unit tests for affected packages
- affected-test strategy must be explicit and deterministic (for example, changed workspace filter using pnpm --filter)
- encoding policy check (UTF-8 without BOM, ASCII-only text except allow list, no smart punctuation unless allowlisted)
- lint/typecheck still run as required local verification and CI gates

CONTRIBUTING.md (required at repo root):

- How to run tests locally
- How to add a new solver algorithm (registry entry, unit tests, worker message support)
- How to add a new benchmark metric safely
- Formatting and lint rules summary (Prettier owns formatting, ESLint owns correctness)

Testing requirements:

- core: movement rules, push rules, win detection, undo/restart, parsing/encoding, constraint enforcement (rejects grids exceeding MAX_GRID_WIDTH etc.)
- formats: import/export parsing, normalization rules, open/variant detection, and warnings
- solver: reachability basics, corner deadlock rule, BFS solves small level(s), cancellation behavior (deterministic), chooseAlgorithm covering every rule branch, analyzeLevel covering edge cases (0 boxes, max boxes, minimal grid)
- worker: protocol schema validation, cancellation path, throttled progress (deterministic simulation), workerHealth transitions on onerror/onmessageerror
- web: key component behaviors (dispatches, renders state), keyboard input handler, buildRenderPlan output correctness for known states

Avoid sleep-based tests; use fake timers for playback.

# ==================================================================== 9) DOCUMENTATION DELIVERABLES

Multi-LLM instruction routing:

- LLM_GUIDE.md at the repo root is the canonical, vendor-neutral authority for all engineering and collaboration rules.
- AGENTS.md and CLAUDE.md at the repo root are short wrappers that point to LLM_GUIDE.md.
- If any instruction conflicts between a wrapper and LLM_GUIDE.md, LLM_GUIDE.md wins.
- Optional additional wrappers: .github/copilot-instructions.md, .cursor/rules/\* - same rule applies.

Other documentation:

- Ensure /docs/Architecture.md exists and matches the decisions above.
- Ensure /docs/project-plan.md exists and defines phases, acceptance criteria, and execution standards.
- Ensure /docs/dev-tools-spec.md exists and defines boundary/tooling implementation details.
- Ensure /docs/Engineering-Process-Playbook.md exists and defines process/governance flow.
- Ensure root /LLM_GUIDE.md exists as canonical and root /AGENTS.md and /CLAUDE.md exist as short wrappers pointing to it.
- Maintain package README(s) for active workspace packages describing public APIs and boundaries.
- Add ADRs only when introducing new cross-cutting patterns beyond what's specified here.

Keep docs short and current.

# ==================================================================== 10) IMPLEMENTATION PLAN (DO THIS IN ORDER)

Phase 0 - Scaffold and enforcement
Decision dependencies: ADR-0001 (Remix-first app shell) and ADR-0002 (monorepo boundaries).

1. Create pnpm workspace + root configs (tsconfig base, eslint with eslint-config-prettier, prettier) and scaffold `apps/web` as Remix in Vite mode
2. Create package folders with public entrypoints (src/index.ts), TS project refs, package.json exports, and optional types fields only when declaration emit is enabled
3. Add lint/typecheck/test scripts and make them pass
4. Add pre-commit hooks (format:check + deterministic affected tests + encoding check)
5. Add CONTRIBUTING.md: run-tests, add-algorithm, add-metric, formatting rules
6. Add root LLM_GUIDE.md canonical + AGENTS.md / CLAUDE.md wrappers

Phase 0 Integration Proofs

- Workspace TS-source imports work in Remix Vite dev and build.
- SSR bundling is correct; document whether `ssr.noExternal` is required and for which packages.
- Vite dev server can access workspace package sources; document whether `server.fs.allow` is needed.
- Vitest runs without loading the Remix plugin, or uses a separate Vite config.

Phase 1 - Levels + Core engine

Status: Complete (Phase 1 scope delivered in this PR)

1. Add packages/shared/src/constraints.ts with MAX_GRID_WIDTH, MAX_GRID_HEIGHT, MAX_BOXES, MAX_BENCH_SUITE_LEVELS, MAX_IMPORT_BYTES
2. Port levels into packages/levels (preserve minified rows compatibility); verify knownSolution uses only UDLR/udlr and preserve case
3. Implement core model + engine functions with high unit coverage; enforce constraint limits in parseLevel
4. Add hashing utilities for solver use

Phase 2 - Web UI parity (Play page)
Decision dependencies: ADR-0001 (app shell) and ADR-0005 (RenderPlan split).
Status: Complete (Phase 2 scope delivered in this PR)

1. Remix app (`apps/web`, Vite mode) + Tailwind layout; configure content globs for workspace packages; set up tokens.css and dark mode class strategy
2. Remix route modules for /play, /bench, /dev/ui-kit with route-level ErrorBoundary exports
3. RTK store + gameSlice
4. Add core helpers applyMoves and selectCellAt with tests (Phase 2 glue)
5. Canvas renderer split: buildRenderPlan(state): RenderPlan (pure, tested) + draw(ctx, plan): void (thin, untested); draw-on-change render loop; keyboard input + move history + restart + undo + next level
6. Sequence input applies moves deterministically
7. Add /dev/ui-kit route rendering all design system primitives

Phase 3 - Worker + baseline solver
Decision dependencies: ADR-0003 (worker protocol), ADR-0004 (push-based solver model), and ADR-0013 (Phase 3 cancellation model).

Status: Complete (Phase 3 scope delivered).

1. Implement protocol schemas + runtime validation
2. Implement solver BFS push-based with cancel token + throttled progress hooks
3. Implement analyzeLevel + chooseAlgorithm in packages/solver/api/selection.ts with unit tests for every rule branch and edge case
4. Implement module worker runtime and client wrapper; add worker.onerror / worker.onmessageerror handling, workerHealth tracking, and hard-reset cancellation semantics
5. Add solverSlice (recommendation + workerHealth fields) + UI panel: show recommendation, run/cancel, progress, apply/animate solution, retry crashed worker

Phase 4 - Benchmark page
Decision dependencies: ADR-0007 (IndexedDB model, migration policy, retention), ADR-0013 (Phase 3 cancellation baseline), ADR-0014 (benchmark cancellation semantics), ADR-0003 (protocol validation strategy), and ADR-0015 (progress light-validation mode).
Status: Complete (Phase 4 scope delivered in this PR, including a scoped optional `light-progress` validation path for SOLVE_PROGRESS while keeping strict mode as default)

1. Benchmark models + runner in packages/benchmarks; define `BENCHMARK_DB_VERSION` + schema constants and IndexedDB schema; add migration tests covering version upgrades
2. Worker pool for benchmark runs: max(1, min(4, (navigator.hardwareConcurrency || 4) - 1))
3. Bench page UI with suite builder + results + persistence adapter (IndexedDB)
4. Call navigator.storage.persist() on adapter init when feature-detected; record outcome in bench diagnostics and log only in dev/debug
5. Add performance.mark/measure instrumentation around solve dispatch and worker response; wire PerformanceObserver to debug perf panel in benchSlice
6. File System Access API export/import for benchmark reports and level packs (anchor-download fallback)
7. Extend protocol schema union discriminator tests when adding BENCH\_\* messages (SOLVE + unknown-type coverage already exists)
8. Revisit solver client cancellation semantics for pooled execution: enforce one active run per SolverClient instance or implement run-scoped in-flight cancellation; update or supersede ADR-0013.
9. Profile protocol validation overhead under benchmark load (`node tools/scripts/profile-worker-validation.mjs` writes `docs/_generated/analysis/phase-04-protocol-validation-profile.md`); if SOLVE_PROGRESS validation is a bottleneck, keep strict validation for structural messages and use a lighter or gated path for high-frequency progress messages.
10. Add solver budget controls to Settings UI (time/node defaults), persist via settingsSlice, and apply them to `/play` solve orchestration defaults.

Phase 5 - Quality and offline
Decision dependencies: ADR-0016 (benchmark export artifact + import contract policy),
ADR-0017 (PWA offline shell strategy), and ADR-0018 (solver-client ping liveness semantics).

Status: Complete (Phase 5 scope delivered in this PR, including Playwright smoke coverage, Workbox
offline shell support, solver ping timeout hardening, and repository-health diagnostics in `/bench`)

1. Add/raise coverage gates to >=95%
2. Add boundary lint rules and ensure no violations
3. Add Playwright smoke suite (route smoke, `/play` interactions, `/bench` persistence/clear, and
   production-path offline readiness checks)
4. Add PWA: service worker/Workbox integration compatible with Remix hosting; verify app loads without network
5. Add solver-client ping timeout hardening: `ping(timeoutMs)` default timeout, reject hung pings deterministically, set worker health to crashed on timeout, and cover with unit tests.
6. Bench diagnostics operability follow-up (deferred from Phase 4): surface persistence health separately from `navigator.storage.persist()` outcome. Acceptance: diagnostics must distinguish at least `durable | memory-fallback | unavailable` (or equivalent `repositoryHealth`) and reflect repository init/load failures even when persist outcome is `granted`.

Deferred notes:

- ReplayController dispatches slice actions directly; consider injecting callbacks or ports when solverSlice expands.
- encoding-check.mjs skips null-byte files; consider hard-failing instead of skipping.
- Replay controller tests rely on action type strings; re-audit when solverSlice expands.
- /play Redux Provider is scoped to the route until cross-route state sharing is needed; keep this unscheduled until a concrete cross-route workflow requires shared store ownership.
- Protocol-level `SOLVE_CANCEL` and `BENCH_CANCEL` remain out of protocol v2 and are unscheduled; revisit only in a future protocol-version ADR after current queue/dispose cancellation semantics are insufficient.
- RenderPlan build is O(cells x boxes); no measured perf issue with current Sokoban sizes or the draw-on-change pipeline. Revisit only if profiling shows regressions.
- Two sources of truth (GameState ref + Redux history) are intentional in Phase 2; revisit if replay or solver integration needs shared state outside /play.
- `/play` now clamps canvas cell size against the available container width to reduce small-screen distortion.
- The root app shell now owns the light/dark `<html>` class, resolves the initial theme before
  paint from persisted preference with `prefers-color-scheme` fallback, and keeps route-scoped
  Redux stores out of theme ownership.
- Core engine linear scans and allocations are deferred until profiling indicates a need.
- Process: keep PR scope manageable; split when Phase 2 and Phase 3 changes start to mix.

Phase 6 - Adapters, tooling, and performance
Decision dependencies: ADR-0006 (embed Shadow DOM and styling delivery strategy), ADR-0010 (format interop policy), ADR-0016 (benchmark export/import contract policy), ADR-0019 (benchmark persistence recovery semantics), ADR-0020 (benchmark comparison snapshot contract), ADR-0021 (solver-kernel delivery/preload contract), ADR-0022 (solver progress throttle ownership), ADR-0023 (Level Lab route-local state ownership), ADR-0024 (Offscreen sprite-atlas worker fallback), and ADR-0025 (SSR-safe route-store bootstrap).
Status: Complete (Phase 6 scope delivered). Deferred debt now lives in `.tracker/issues/*.md` and
`KNOWN_ISSUES.md`; it should not be treated as a Phase 6 closeout blocker. Phase 7 Task 10 owns
the remaining `pnpm best-practices` CLI/report wiring work tracked in `DEBT-007`.

1. [done] Level Lab page (/lab): level editor (text input for row encoding) + keyboard-first preview/play area + one-click solver/bench run + export/import JSON
2. [done] formats package: XSB/SOK/SLC import/export with the documented SOK subset, normalization rules, and variant detection; integrate with Level Lab and import/export flows
3. [done] Embed adapter (`packages/embed`): `<corgiban-embed>` custom element mounting a minimal React subtree with Shadow DOM + scoped stylesheet injection. Bundle React as a dependency (not peer). Follow ADR-0006 lifecycle/cleanup constraints and add integration tests covering attribute changes, DOM events, unmount, and the precedence contract where known built-in `level-id` values override `level-data`, `level-data` handles missing/unknown ids, and unresolved inputs fail closed.
4. [done] OffscreenCanvas: move sprite pre-rendering into a dedicated app-owned worker using OffscreenCanvas; keep main-thread renderer as fallback for browsers that don't support it and keep this optimization out of the solver/benchmark worker protocol
5. [done] WASM kernels (`packages/solver-kernels`): implement reachability flood fill, state hashing, and assignment heuristic in TS first, and land app-owned URL wiring plus best-effort worker preload scaffolding for future promoted Rust + `wasm-pack` kernels (`instantiateStreaming` + fallback). Solve and bench execution remain on the TS solver path in this phase.
6. [done] Profile and reduce solve-progress overhead by consolidating throttling strategy across solver and worker: choose one primary throttle layer, avoid per-expansion progress churn, and verify effective progress cadence under load.
7. [done] Benchmark analytics follow-up: add aggregate views (for example success rate and p50/p95 elapsed time) for persisted benchmark runs.
8. [done] Benchmark comparison UX follow-up: add multi-suite comparison workflows (baseline selection, diff tables/charts, and exportable comparison snapshots) with strict suite-input comparability based on stored solver/environment/warm-up metadata.
9. [done] Benchmark/report import hardening (deferred from Phase 4): enforce a versioned benchmark report parser with strict record validation (required solver `options`, validated enum-like fields, explicit unsupported-version errors) and define compatibility behavior for future schema versions.
10. [done] Level pack import contract hardening + warm-up UX follow-up (deferred from Phase 4): require versioned level-pack payloads (`type` + `version`) and add `/bench` warm-up controls (`warmupRepetitions`) with clear separation of warm-up vs measured runs in UI copy and exported metadata.
11. [done] Benchmark persistence durability semantics follow-up (deferred from Phase 5): define and implement repository-recovery behavior after `memory-fallback` (for example sticky degraded mode, write-back replay queue, or explicit reset policy), then make the selected durability semantics explicit in `/bench` diagnostics copy and docs.
12. [done] Offline verification fidelity follow-up (deferred from Phase 5): extend validation beyond iframe-based same-origin checks to include a documented strategy for top-level offline reload/navigation proof (automated when feasible, otherwise explicit manual proof steps captured in-repo).
13. [done] Smoke orchestration consistency follow-up (deferred from Phase 5): align CI and local smoke execution to a single source of truth (either CI calls `pnpm test:smoke` or the script delegates to CI-owned build/test split) and document the contract in contributing docs.

Deferred notes:

- Route-responsibility follow-up: `/play` should converge on primary gameplay, while `/lab` should retain authoring/debug workflows such as format conversion, worker checks, and preview diagnostics. Phase 7 owns this clarification; avoid expanding route overlap further before that pass lands.
- `/lab` intentionally keeps authored text, preview state, and one-click worker status in route-local React state + direct ports (ADR-0023). Revisit only if Phase 7 handoff flows require shared store ownership.
- `/play` and `/bench` now keep one stable route-scoped store instance and swap mutable no-op ports
  for browser-backed ports after commit (ADR-0025). Future shared-store work must preserve that
  SSR-safe browser-resource ownership model or supersede it explicitly.

Phase 7 - UX and route-responsibility pass (in progress)
Decision dependencies: capture an ADR if route ownership, store ownership, or cross-route workflow contracts change materially.

Status: In progress (root app-shell theme ownership, shared navigation, landing page, and the
route-level information-architecture/accessibility refresh have landed; explicit cross-route
handoff flows and `pnpm best-practices` report wiring remain pending).

1. Define explicit route charters, entry points, and non-goals for `/play`, `/lab`, and `/bench`:
   - `/play`: primary gameplay, undo/restart/history, replay, lightweight solver help, and quick open/import actions
   - `/lab`: authoring/debugging, raw format editing/conversion, validation, preview diagnostics, and single-level solve/bench sanity checks
   - `/bench`: benchmark suite creation, persistence, analytics/comparison, exports/imports, and durability diagnostics
2. Remove or demote overlapping controls so each advanced workflow has a clear home:
   - batch/suite operations belong in `/bench`
   - raw format conversion and parser diagnostics belong in `/lab`
   - normal play, replay, and friendly solver assist belong in `/play`
3. Add explicit cross-route handoff flows instead of duplicating full toolsets:
   - open the current level in `/play`
   - open the current level or imported text in `/lab`
   - send a level or pack from `/lab` to `/bench`
   - jump from benchmark results back to `/play` or `/lab`
4. [done] Rework route navigation and page information architecture around primary jobs rather than implementation detail:
   - clearer route labels and help text
   - route-local sections ordered by frequency and user intent
   - advanced/debug controls visually secondary to the main task
5. Simplify `/play` for first-time and repeat play:
   - friendlier solver recommendation copy and defaults
   - advanced solver controls behind disclosure panels
   - restart/undo/replay controls more prominent than debug metadata
6. Rework `/lab` around an authoring flow:
   - input/edit -> parse/validate -> preview/play -> worker checks -> export/share
   - parser warnings/errors easier to scan and map back to the source text
   - import/export and format conversion promoted to first-class actions
7. Rework `/bench` around benchmark workflow clarity:
   - suite setup, warm-up, active run status, analytics, comparisons, and history clearly separated
   - diagnostics remain available but secondary to benchmark outcomes
   - saved suites/baselines become the starting point for comparison workflows
8. Improve route-level UX states across the app:
   - empty/loading/error/success states
   - worker crashed/retry states
   - persistence degraded/offline messaging
   - keyboard-shortcut discoverability and responsive/mobile ergonomics
9. Add usability-oriented tests for at least one primary happy path per route plus cross-route handoff flows.
10. Finish the remaining best-practices CLI/report wiring in `tools/` so `pnpm best-practices` produces a real report artifact (tracked in `DEBT-007`):

- connect the implemented `scanFiles` / `analyzeFiles` helpers to the CLI entrypoint and write the generated report to disk
- replace opaque `P` / `W` / `F` issue labels in human-facing output with descriptive severity/size wording
- make the generated report explicitly define the meaning of each reported size/severity bucket instead of assuming shorthand knowledge

Phase 8 - Solver optimization and advanced search (planned)
Decision dependency: ADR-0009 (solver-optimized state representation and hashing).

1. Decide solver optimality target (push-optimal vs move-optimal vs any-solution) and document in an ADR if it changes from push-optimal; keep the push-based action model.
2. Introduce solver-only CompiledLevel precomputations: neighbor table, walls/goals bitsets, dead squares, and goal-distance tables; keep data immutable and shareable across algorithms. Make goal-distance computation lazy or conditional by algorithm/heuristic so BFS baseline does not pay avoidable setup cost.
3. Introduce SolverState minimal representation: sorted boxes list plus occupancy bitset (or boolean array), canonical player index within the reachable region, and 64-bit Zobrist key (bigint or two uint32) for visited/transposition use.
4. Replace string visited keys with numeric Zobrist keys; define an optional collision check strategy and add determinism tests.
5. Add advanced heuristics: assignment (Hungarian) using precomputed distances, optional pattern database lookups; keep admissibility for optimal solvers.
6. Expand deadlock pruning: 2x2 blocks, frozen patterns/corrals, maze-specific deadlock tables or pattern search; add regression tests per rule.
7. Add macro push generation (tunnels/rooms) to reduce effective depth; ensure solver output still expands to UDLR moves.
8. Optional: reverse or bidirectional search support using the same SolverState encoding.
9. Optional: portfolio/parallel solver runs in workers with shared caches and coordinated cancellation.
10. Remove BFS state creation double-allocation/sort by adding an `alreadySorted` fast-path to `createSolverState` (or by inlining state construction in algorithms that already maintain sorted boxes).
11. Reduce BFS timing overhead by sampling `nowMs()` at a coarse expansion interval (for example every 256 or 1024 nodes) while preserving budget and progress correctness.
12. Optimize `expandSolution` box updates by replacing per-push linear `indexOf` lookup with an indexed structure (reverse index map or equivalent), with regression coverage for long solutions.

Phase 9 - UI, visual, and sprite polish pass (planned)
Decision dependencies: capture an ADR if the renderer asset pipeline, theme system, or animation strategy changes materially.

1. Establish a cohesive visual direction across the app:
   - typography, color tokens, spacing scale, panel hierarchy, and icon treatment
   - route-specific emphasis without breaking the shared design system
2. Introduce a sprite or illustrated asset pipeline for the board:
   - walls, floors, goals, boxes, player/corgi, and box-on-goal states
   - crisp scaling on desktop/mobile and a safe fallback while assets load or if sprites are disabled
3. Improve board readability and game feel:
   - stronger target visibility
   - clearer wall depth/edge definition
   - more distinct player facing/idle/push states
   - better solved-state celebration and feedback
4. Polish motion and transitions:
   - move/push animation tuning
   - replay transitions
   - solver/benchmark status transitions
   - restrained page and panel reveal motion
5. Rework the friendliness and scanability of the major route surfaces:
   - `/play` HUD, board framing, controls, and side panels
   - `/lab` editor/preview/workflow split
   - `/bench` analytics, comparison views, and history presentation
6. Strengthen responsive/mobile behavior:
   - touch-friendly targets
   - compact panel variants
   - landscape board handling
   - no overflow traps on small screens
7. Make accessibility part of the polish pass:
   - reduced-motion support
   - contrast audits
   - stronger focus states
   - keyboard order and descriptive status text for visual-only cues
8. Add visual-regression/smoke coverage and a manual review checklist for assets, layout stability, and reduced-motion fallbacks.

Phase 10 - Browser-dev tools workspace (planned)
Decision dependencies: capture an ADR if the workspace template, package distribution story, or `/lab` public tooling contract changes materially.

1. Add a dedicated `/lab` Dev Tools workspace surface that is part of the roadmap but still loaded on demand:
   - dynamic import only
   - explicit feature flag (default OFF until approved)
   - browser capability checks with a clear unsupported fallback
2. Define a versioned "Repro Session" payload generated from the current `/lab` state:
   - level text plus normalized format
   - selected solver algorithm/options
   - selected benchmark options
   - parser warnings/errors and derived metadata
   - import/export/share support for that payload
3. Add editable, runnable examples that target public package entrypoints only:
   - parse a level
   - run a single solve
   - run a small benchmark
   - render an embed/example surface
4. Use Sandpack for lightweight example editing and preview when a full Node-like environment is unnecessary.
5. Use WebContainers for a generated minimal workspace seeded from the current Repro Session:
   - editable files
   - install/start lifecycle
   - terminal and console panes
   - reset/restart/stop controls
6. Add one-click actions from `/lab` into the workspace:
   - open current level as a fixture
   - open parser repro
   - open solver repro
   - open benchmark repro
7. Define operational limits and cleanup behavior:
   - `/lab`-only
   - never part of base app startup
   - resource limits, timeout handling, and explicit teardown when the workspace closes
   - not required for normal play/solve/bench product flows
8. Add coverage for flag OFF/ON behavior, unsupported-browser fallback, Repro Session generation, and basic workspace boot smoke.

Phase 11 - Race Mode and multi-runner play (planned)

1. Add `SolverPersonality` type and built-in personality bundles in `packages/solver`.
2. Extend `solverSlice` to hold `runId -> { personality, progress, result, replayState }` for multi-runner support.
3. Add Race Mode UI on `/play` with multiple corgis and progress metrics.
4. Run concurrent solver runs via worker pool; cap pool size at `max(1, min(4, hardwareConcurrency - 1))`.
5. Add race result screen showing winner by `elapsedMs` and replaying each solution.
6. Integration dependency: worker pool support, `bestPathSoFar` in `SOLVE_PROGRESS`, and `SolverPersonality` typing.

# ==================================================================== 11) ACCEPTANCE CRITERIA (REQUIRED)

- `pnpm typecheck` passes (tsc project references)
- `pnpm lint` passes
- `pnpm test:coverage` passes with enforced thresholds (>=95% overall)
- `pnpm test:smoke` passes with required service-worker readiness checks on the production path
- `pnpm dev` runs:
  - /play supports keyboard moves, restart, undo, move history
  - /play solver panel shows algorithm recommendation (for example, "Recommended: bfsPush (7 boxes)") and allows override
  - /play solver panel can start/cancel a solve; progress updates; result can be applied/animated
  - /play solver panel shows Retry button when worker is crashed; clicking it recreates the worker
  - /lab route loads level editor controls, supports parsing CORG/XSB/SOK/SLC input, offers keyboard preview controls, and can run one-click worker solve/bench checks
  - /bench route loads and can run a small benchmark suite; results persist in IndexedDB across page reloads
  - /bench supports warm-up repetitions and excludes warm-up runs from measured persisted results
  - /bench analytics panel surfaces success rate and p50/p95 elapsed-time comparisons across suites
  - /bench comparison snapshot export stays disabled when the selected baseline lacks comparable metadata; enabled exports include non-comparable suites with explicit reasons and null deltas
  - /bench export produces a valid JSON file; import round-trips correctly
  - navigator.storage.persist() is requested on adapter init when supported; outcome is stored in bench diagnostics (console logging only in dev/debug)
  - bench diagnostics distinguish repository health (`durable | memory-fallback | unavailable`) independently from `navigator.storage.persist()` outcome
  - performance.mark/measure entries are visible in the browser DevTools Performance panel during a solve or bench run
  - /dev/ui-kit route renders all design system primitives
- `pnpm build` produces a PWA: app shell loads without a network connection after first visit (Workbox service worker active)

# ==================================================================== 12) EXECUTION AND REPORTING STANDARDS

Before implementation:

- Print the proposed file tree and a short checklist of steps you will implement.

During implementation:

- Keep commits logically grouped (if your workflow supports it) or keep changes well-organized.

After implementation:

- List the commands to run and what they should output (high-level).
- Call out any deliberate tradeoffs or deferred items (short).
