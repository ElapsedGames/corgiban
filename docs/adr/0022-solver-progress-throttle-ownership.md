# ADR 0022: Solver-owned progress throttling and spectator-gated worker progress

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

Phase 6 follow-up work reduced solve-progress overhead and removed the extra worker-runtime
throttle layer. Before that consolidation, progress cadence decisions could drift across:

- solver algorithms
- worker runtimes
- app adapters consuming worker progress

That duplication made profiling harder and risked inconsistent behavior between `/play` and
`/bench`. The worker layer also needs different progress behavior depending on whether a caller is
actively consuming high-frequency updates.

This decision interacts with:

- ADR-0003 (worker protocol versioning and validation)
- ADR-0011 (solver protocol solution/progress payload contract)
- ADR-0014 (benchmark cancellation semantics)
- ADR-0015 (light-progress validation mode)

## Decision

- The solver layer owns progress throttling.
- Solver algorithms use solver-side reporting helpers and accept caller-requested cadence through
  `SolveContext.progressThrottleMs` and `SolveContext.progressExpandedInterval`.
- Worker runtimes do not apply a second runtime throttle layer after solver progress is emitted.
- Worker runtimes may request a coarser cadence by passing solver-context throttle fields when they
  call `solve(...)`.
- Benchmark worker progress remains spectator-gated:
  - `BENCH_PROGRESS` is emitted only when `enableSpectatorStream === true`
  - app adapters should enable worker progress streaming only when a consumer is attached

## Consequences

**Positive:**

- One source of truth for progress cadence across solver and worker paths.
- Less hot-path duplication and simpler profiling of progress overhead.
- Worker adapters can request different cadence without owning throttling logic themselves.
- Benchmark runs avoid unnecessary progress traffic when no spectator consumer exists.

**Negative:**

- Progress cadence tuning now requires touching solver-side reporting logic and context plumbing.
- Callers must understand the difference between requesting cadence and applying a second throttle.

## Alternatives considered

- Keep separate throttles in solver and worker runtimes.
- Move all throttling to app adapters after worker messages are received.
- Emit every progress update and rely on validation or UI consumers to absorb the overhead.

## Rollout plan (if applicable)

- Keep solver-side progress helpers as the only throttle implementation.
- Pass desired cadence from worker runtimes through solver context.
- Keep benchmark worker progress disabled by default unless a spectator consumer is attached.
- Document the contract in architecture, guide, and package docs.

## Testing plan

- Solver progress-reporter tests cover throttle interval and expanded-delta behavior.
- Solver algorithm tests cover context-driven cadence fields.
- Worker runtime tests verify requested cadence is forwarded through solve context.
- Benchmark worker/runtime tests verify `BENCH_PROGRESS` is suppressed unless
  `enableSpectatorStream` is enabled.

## Links

- `docs/Architecture.md` (worker protocol and runtime sections)
- `docs/project-plan.md` (Phase 6 task 6)
- `packages/solver/README.md`
- `packages/worker/README.md`
