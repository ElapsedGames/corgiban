# packages/solver

Solver algorithms, heuristics, and pruning logic.

## Responsibilities

- Push-based search model (macro pushes)
- Player reachability calculation between pushes
- Algorithm registry (BFS/A*/IDA* etc.)
- `analyzeLevel(levelRuntime): LevelFeatures` - pure; extracts box count, grid size, reachability complexity
- `chooseAlgorithm(features): AlgorithmId` - deterministic rule table; both are part of the public API
- `expandSolutionFromStart(levelRuntime, pushes): Direction[]` - expands push sequences into full UDLR walk+push paths from the initial state
- `expandSolution(levelRuntime, pushes, start): Direction[]` - expands push sequences from an explicit starting state (UDLR neighbor order)
- Heuristics (Manhattan baseline; assignment heuristic optional)
- Deadlock detection/pruning (corner deadlocks first, expand over time)
- Deterministic progress reporting hooks
- SolverOptions validation (budgets, heuristic defaults, weighted A\*, rejects heuristics for bfsPush)

## Current status (Phase 3 partial)

- Implemented: solver option normalization/validation, solver constants, solution expansion utilities.
- Pending: solver algorithms, registry/selection (`analyzeLevel`/`chooseAlgorithm`), heuristics, deadlock pruning, cancel token, and progress hooks.

## Allowed imports

- `packages/core` - engine types and `LevelRuntime`
- `packages/shared` - types, result helpers, constraints

`packages/levels` is **not** allowed - the solver receives compiled `LevelRuntime` objects from core, never raw level data.
No other workspace packages. No DOM, no Web APIs, no React.

## Hard constraints

- Deterministic given the same inputs and options
- `Date` and `Date.now` are banned - determinism requirement enforced by ESLint
- `SharedArrayBuffer` and `Atomics` are banned repo-wide
- Must support cooperative cancellation via `CancelToken`

## Output contract

- Solutions are returned as canonical move strings:
  - `Direction = 'U' | 'D' | 'L' | 'R'`
- Macro pushes must be expanded into full move strings for playback.

## Testing

- Coverage target: **98-100%** (enforced in CI)
- Unit tests for reachability, pruning, hashing, cancellation
- Tests for every `chooseAlgorithm` rule branch and `analyzeLevel` edge case (0 boxes, max boxes, minimal grid)
- Small fixture levels for algorithm correctness
