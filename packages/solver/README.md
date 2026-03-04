# packages/solver

Solver algorithms, heuristics, and pruning logic.

## Responsibilities

- Push-based search model (macro pushes)
- Player reachability calculation between pushes
- Algorithm registry (BFS/A*/IDA* etc.)
- `analyzeLevel(levelRuntime): LevelFeatures` - pure; extracts box count, grid size, reachability complexity
- `chooseAlgorithm(features): AlgorithmId` - deterministic rule table with fallback to implemented algorithms; both are part of the public API. The selector never returns ids outside `IMPLEMENTED_ALGORITHM_IDS`.
- `expandSolutionFromStart(levelRuntime, pushes): Direction[]` - expands push sequences into full UDLR walk+push paths from the initial state
- `expandSolution(levelRuntime, pushes, start): Direction[]` - expands push sequences from an explicit starting state (UDLR neighbor order)
- Heuristics (Manhattan baseline; assignment heuristic optional)
- Deadlock detection/pruning (corner deadlocks first, expand over time)
- Deterministic progress reporting hooks
- SolverOptions validation (budgets, heuristic defaults, weighted A\*, rejects heuristics for bfsPush)

## Current status (Phase 3 baseline solver)

- Implemented: solver option normalization/validation, solution expansion utilities, compiled level + solver state scaffolding, reachability, cancellation/progress hooks, BFS push-based solver, registry/solve entrypoint, and selection (`analyzeLevel`/`chooseAlgorithm` with implemented-algorithm fallback).
- Pending: A* / IDA* algorithms, assignment heuristic integration, and additional deadlock pruning beyond corners.

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
- If `performance.now()` is unavailable, it falls back to a constant `0` clock (time budgets will not elapse in that environment).
- For deterministic tests and deterministic offline runners, pass `context.nowMs` explicitly.

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
  `globalThis.performance.now()` and fall back to `0` when unavailable

## Output contract

- Solutions are returned as canonical move strings:
  - `Direction = 'U' | 'D' | 'L' | 'R'`
- Macro pushes must be expanded into full move strings for playback.

## Testing

- Coverage target: **98-100%** (enforced in CI)
- Unit tests for reachability, pruning, hashing, cancellation
- Tests for every `chooseAlgorithm` rule branch and `analyzeLevel` edge case (0 boxes, max boxes, minimal grid)
- Small fixture levels for algorithm correctness
- When enabling new algorithms, update `IMPLEMENTED_ALGORITHM_IDS` and web UI availability together so recommendations and selectable options remain consistent.
