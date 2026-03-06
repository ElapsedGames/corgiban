# Review Notes

This file exists to reduce repeat review churn on behaviors that are deliberate existing
contracts.

## Intentional existing contracts

### `/play` solver cancellation is a hard worker reset

- Protocol v2 intentionally does not define `SOLVE_CANCEL`.
- `createSolverClient.cancel(runId)` is expected to reject the active run, terminate the current
  worker, and recreate a fresh worker instance.
- This contract is scoped to interactive `/play` solve orchestration. Benchmark cancellation uses a
  different path: queue cancel plus suite disposal.

Source of truth:

- `docs/adr/0013-solver-cancellation-worker-reset.md`
- `docs/adr/0014-benchmark-worker-cancellation-semantics.md`
- `docs/Architecture.md`
- `packages/worker/README.md`
- `packages/worker/src/client/__tests__/solverClient.test.ts`
- `packages/worker/src/runtime/__tests__/solverWorker.test.ts`

Review guidance:

- Treat worker recreation on `/play` cancel as the accepted baseline contract unless a later ADR
  supersedes ADR-0013.
- Do not flag the lack of `SOLVE_CANCEL` in protocol v2 as a Phase 6 defect by itself.

### Missing monotonic clock is an explicit failure

- Solver timing prefers `context.nowMs`.
- If callers omit `context.nowMs`, `solve(...)` may use `globalThis.performance.now()` when
  available.
- If no monotonic clock is available, the solver intentionally returns an explicit error instead of
  falling back to `Date.now()` or another non-monotonic source.
- Worker runtimes preserve that contract by leaving `context.nowMs` unset when
  `performance.now()` is unavailable.

Source of truth:

- `LLM_GUIDE.md`
- `docs/Architecture.md`
- `packages/solver/README.md`
- `packages/worker/README.md`
- `packages/solver/src/api/__tests__/solve.test.ts`
- `packages/worker/src/runtime/__tests__/solverWorker.test.ts`
- `packages/worker/src/runtime/__tests__/benchmarkWorker.test.ts`

Review guidance:

- Treat explicit clock-unavailable failures as contract enforcement, not as a missing fallback.
- Do not propose `Date.now()` as a substitute unless solver timing semantics are intentionally
  changed and documented.
