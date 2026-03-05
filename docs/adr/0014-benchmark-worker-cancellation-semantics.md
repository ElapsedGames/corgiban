# ADR 0014: Benchmark worker cancellation semantics

**Status:** Accepted
**Date:** 2026-03-04
**Deciders:** Corgiban maintainers

## Context

Phase 4 introduces pooled benchmark execution where many run-scoped benchmark jobs are queued and
dispatched across multiple workers. The cancellation model for this flow differs from interactive
`/play` usage:

- `/play` needs immediate user-visible cancellation of a single active run.
- `/bench` needs deterministic suite-level control over queued and in-flight pooled runs.

ADR-0013 already defines `/play` behavior for protocol v2 baseline cancellation (hard worker reset
in `SolverClient`, no protocol-level `SOLVE_CANCEL`).

## Decision

- Keep ADR-0013 unchanged as the `/play` baseline.
- Keep benchmark protocol run-scoped (`BENCH_START`, `BENCH_PROGRESS`, `BENCH_RESULT`) and keep
  suite orchestration outside protocol messages.
- Benchmark cancellation is two-tier:
  - `WorkerPool.cancel(runId)` cancels queued runs only.
  - `WorkerPool.dispose()` cancels queued and in-flight suite work and disposes worker clients.
- `BenchmarkClient` uses a `suiteGeneration` guard so stale progress/result callbacks become
  no-ops after suite cancellation/dispose.
- `SolverClient` enforces one active run per instance for pooled safety while retaining existing
  hard-reset `cancel(runId)` semantics from ADR-0013.

## Consequences

**Positive:**

- `/play` cancellation remains stable and deterministic without protocol changes.
- Benchmark suite cancellation is explicit and testable for both queued and in-flight paths.
- Stale callback races after cancel/dispose are contained by generation gating.

**Negative:**

- Benchmark in-flight cancellation still uses worker disposal, not cooperative in-worker cancel.
- Pool disposal resets benchmark workers, which adds startup cost for subsequent suites.

## Alternatives considered

- Add protocol-level in-flight cancel for benchmark runs in protocol v2.
- Reuse `/play` hard-reset cancel semantics directly for every benchmark run.
- Ignore late callbacks/results without generation gating.

## Rollout plan (if applicable)

- Land BENCH protocol/runtime/client changes with queue cancel + suite dispose tests.
- Keep `SOLVE_CANCEL` and `BENCH_CANCEL` out of protocol v2.
- Revisit run-scoped in-worker cancellation in a future protocol version if needed.

## Testing plan

- Worker pool tests cover queue-only cancel and disposal behavior.
- Benchmark client tests cover queued cancel, in-flight suite cancel, and late-result races.
- Solver client tests cover one-active-run enforcement and retained hard-reset cancel behavior.

## Links

- `docs/adr/0013-solver-cancellation-worker-reset.md`
- `docs/adr/0003-worker-protocol-versioning-validation.md`
- `docs/project-plan.md` (Phase 4 tasks 2, 7, 8, 9)
