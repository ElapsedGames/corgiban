# ADR 0011: Solver protocol solution contract and options validation

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Corgiban maintainers

## Context

The solver uses a push-based action model. The UI and benchmark pipeline need a consistent,
fully expanded move sequence (UDLR steps) for playback, plus deterministic metrics for
comparison. The worker protocol previously named `metrics` and `options` without defining
their contents, and `SOLVE_PROGRESS` had no slot for streaming a best-so-far solution.

These details affect multiple layers (solver, worker protocol, UI replay) and must be
explicit to avoid ad-hoc expansion or schema drift.

## Decision

- Solver output is always a fully expanded UDLR walk+push string using uppercase-only
  directions. knownSolution may remain mixed-case for import/export fidelity, but it is
  treated as direction-only after normalization (push markers are not used by the solver
  or replay pipeline).
- A push is represented as `{ boxIndex: number; direction: Direction }`.
- Walk-path reconstruction uses BFS from the current player position to the push-entry
  cell, expanding neighbors in canonical order `U, D, L, R`. The first minimum-length
  path is used (deterministic).
- `SOLVE_RESULT.metrics` includes:
  - `elapsedMs`, `expanded`, `generated`, `maxDepth`, `maxFrontier`, `pushCount`, `moveCount`.
- `SOLVE_PROGRESS.bestPathSoFar?: string` is reserved for spectator streams. When present,
  it is a fully expanded UDLR walk+push string and is only sent when
  `SolverOptions.enableSpectatorStream === true`.
- `SolverOptions` are typed and validated:
  - `timeBudgetMs?: number` (> 0)
  - `nodeBudget?: number` (> 0)
  - `heuristicId?: 'manhattan' | 'assignment'` (rejected for `bfsPush`)
  - `heuristicWeight?: number` (range 1.0-10.0; > 1.0 enables Weighted A\*)
  - `enableSpectatorStream?: boolean` (default false)
  - A\*-family defaults: `heuristicId = 'manhattan'`, `heuristicWeight = 1.0`.

## Consequences

**Positive:**

- UI can replay solver output directly without importing solver reachability logic.
- Protocol fields are explicit and stable for benchmarks and race comparisons.
- Deterministic tie-breaking removes replay ambiguity.

**Negative:**

- Solver must perform expansion work before returning results.
- Slightly larger protocol payloads for `solutionMoves` and `bestPathSoFar`.

## Alternatives considered

- Expand pushes in the app layer (rejected: boundary violation and duplicated BFS logic).
- Leave `metrics` shape unspecified (rejected: breaks reproducible comparisons).
- Use push-only `bestPathSoFar` (rejected: would require app-side expansion logic).
- Allow free-form `options` without validation (rejected: inconsistent behavior and harder debugging).

## Rollout plan (if applicable)

- Add `expandSolutionFromStart` to `packages/solver` (and the explicit-start `expandSolution`)
  and call it on solver completion.
- Update worker protocol schemas to include metrics and `bestPathSoFar`.
- Add `SolverOptions` normalization and validation.
- Update documentation and tests.

## Testing plan

- Unit tests for `expandSolution` path reconstruction and deterministic ordering.
- Protocol schema tests for new fields.
- SolverOptions validation tests for bounds and defaults.

## Links

- `docs/Architecture.md` sections 7, 8, and 10
- `docs/project-plan.md` Phase 3
- ADR-0003 (worker protocol versioning)
- ADR-0004 (push-based solver model)
