# packages/solver

Solver algorithms, heuristics, and pruning logic.

## Responsibilities

- Push-based search model (macro pushes)
- Player reachability calculation between pushes
- Algorithm registry (`bfsPush`, `astarPush`, `idaStarPush`, `greedyPush`, `tunnelMacroPush`, `piCorralPush`)
- `analyzeLevel(levelRuntime): LevelFeatures` - pure; extracts box count, grid size, reachability complexity, and tunnel density
- `chooseAlgorithm(features): AlgorithmId` - deterministic rule table with fallback to implemented algorithms; both are part of the public API. The selector never returns ids outside `IMPLEMENTED_ALGORITHM_IDS`.
- `expandSolutionFromStart(levelRuntime, pushes): Direction[]` - expands push sequences into full UDLR walk+push paths from the initial state
- `expandSolution(levelRuntime, pushes, start): Direction[]` - expands push sequences from an explicit starting state (UDLR neighbor order)
- Heuristics (Manhattan baseline and assignment matching)
- Deadlock detection/pruning (corner deadlocks first, expand over time)
- Deterministic progress reporting hooks
- SolverOptions validation (budgets, heuristic defaults, weighted A\*, rejects unsupported heuristic fields for `bfsPush` and `greedyPush`)

## Current status

- Implemented: solver option normalization/validation, solution expansion utilities, compiled
  level + tunnel metadata, shared priority-search infrastructure, solver state scaffolding,
  reachability, cancellation/progress hooks, BFS/A*/IDA*/Greedy/Tunnel-Macro/PI-Corral
  push-based solvers, Manhattan + assignment heuristics, corner + PI-corral pruning,
  registry/solve entrypoint, and deterministic selection (`analyzeLevel`/`chooseAlgorithm`).
- Pending: additional deadlock pruning and later solver-optimization follow-ups.

## Public API surface

Export from `src/index.ts` only.

Runtime exports:

- `solverVersion`
- `analyzeLevel(levelRuntime): LevelFeatures`
- `chooseAlgorithm(features): AlgorithmId`
- `solve(levelRuntime, algorithmId, options?, hooks?, context?): SolveResult`
- `normalizeSolverOptions(algorithmId, options?)`
- `expandSolution(levelRuntime, pushes, start)` / `expandSolutionFromStart(levelRuntime, pushes)`
- `directionsToString(directions)`
- `ALGORITHM_IDS` (planned + implemented ids)
- `IMPLEMENTED_ALGORITHM_IDS` (currently runnable ids)
- `DEFAULT_ALGORITHM_ID`
- `DEFAULT_SOLVER_TIME_BUDGET_MS`
- `DEFAULT_NODE_BUDGET`
- `DEFAULT_SOLVER_PROGRESS_THROTTLE_MS`
- `DEFAULT_SOLVER_PROGRESS_EXPANDED_INTERVAL`
- `HEURISTIC_IDS`
- `MIN_HEURISTIC_WEIGHT` / `MAX_HEURISTIC_WEIGHT`
- `isImplementedAlgorithmId(algorithmId)`

Type exports include:

- `AlgorithmId`, `HeuristicId`, `LevelFeatures`
- `SolverOptions`, `SolverHooks`, `SolverProgress`
- `SolveResult`, `SolveStatus`, `SolverMetrics`
- `Push`, `SolveContext`, `NormalizedSolverOptions`, `ExpansionStart`

## Usage example

```ts
import {
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLVER_TIME_BUDGET_MS,
  analyzeLevel,
  chooseAlgorithm,
  solve,
} from '@corgiban/solver';

const features = analyzeLevel(levelRuntime);
const algorithmId = chooseAlgorithm(features);
const result = solve(levelRuntime, algorithmId, {
  timeBudgetMs: DEFAULT_SOLVER_TIME_BUDGET_MS,
  nodeBudget: DEFAULT_NODE_BUDGET,
});
```

Clock behavior:

- If `context.nowMs` is omitted, `solve(...)` uses `globalThis.performance.now()` when available.
- If `performance.now()` is unavailable, `solve(...)` returns an explicit error result; callers in
  that environment must pass `context.nowMs`.
- This is an intentional contract: the solver does not fall back to `Date.now()` or any other
  non-monotonic source.
- For deterministic tests and deterministic offline runners, pass `context.nowMs` explicitly.

Current recommendation/defaults:

- `chooseAlgorithm(...)` uses this ordered rule table:
  - `tunnelMacroPush` when `tunnelCellCount >= 4 && tunnelRatio >= 0.18`
  - `piCorralPush` when `boxCount >= 7 && (reachableRatio <= 0.72 || boxDensity >= 0.10)`
  - `greedyPush` when `boxCount <= 2 && reachableRatio >= 0.70 && boxDensity <= 0.10`
  - `bfsPush` when `boxCount <= 3`
  - `astarPush` when `boxCount <= 6`
  - `idaStarPush` otherwise
- `normalizeSolverOptions(...)` defaults:
  - `astarPush` -> `heuristicId: 'manhattan'`, `heuristicWeight: 1`
  - `idaStarPush` / `tunnelMacroPush` / `piCorralPush` -> `heuristicId: 'assignment'`, `heuristicWeight: 1`
  - `greedyPush` -> `heuristicId: 'assignment'` and rejects `heuristicWeight`
- `heuristicWeight` defaults to `1` for heuristic-driven algorithms that support it.

Performance note:

- `analyzeLevel(...)` now inspects compiled tunnel metadata as part of recommendation selection.
- If recommendation rules or `compileLevel(...)` cost changes, run
  `pnpm profile:analyze-level:browser` against preview and keep
  `docs/verification/analyze-level-main-thread-profile.md` current.

Progress cadence:

- Progress throttling is solver-owned.
- Callers can request coarser emission through `SolveContext.progressThrottleMs` and
  `SolveContext.progressExpandedInterval`.
- Worker runtimes should pass those fields through solver context instead of adding a second
  runtime throttle layer.

## Allowed imports

- `packages/core` - engine types and `LevelRuntime`
- `packages/shared` - types, result helpers, constraints

`packages/levels` is **not** allowed - the solver receives compiled `LevelRuntime` objects from core, never raw level data.
No other workspace packages. No DOM imports and no React.

## Hard constraints

- Deterministic given the same inputs and options
- `Date` and `Date.now` are banned - determinism requirement enforced by ESLint
- `SharedArrayBuffer` and `Atomics` are banned repo-wide
- Must support cooperative cancellation via `CancelToken`
- Timing should flow through `context.nowMs`; if omitted, `solve(...)` may read
  `globalThis.performance.now()`, and callers must provide `context.nowMs` when that clock is
  unavailable. Missing monotonic time is an explicit error path, not a silent fallback case.

## Output contract

- Solutions are returned as canonical move strings:
  - `Direction = 'U' | 'D' | 'L' | 'R'`
- Macro pushes must be expanded into full move strings for playback.

## Testing

- Coverage target: **98-100%** (enforced in CI)
- Unit tests for reachability, pruning, hashing, cancellation
- Tests for every `chooseAlgorithm` rule branch and `analyzeLevel` edge case (0 boxes, max boxes, minimal grid)
- Small fixture levels for algorithm correctness
- `src/api/__tests__/solve.test.ts` covers both the `performance.now()` default path and the
  explicit error returned when no monotonic clock source is available.
- When enabling new algorithms, update `IMPLEMENTED_ALGORITHM_IDS` and web UI availability together so recommendations and selectable options remain consistent.
