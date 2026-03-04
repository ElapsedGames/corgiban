# ADR 0013: Solver cancellation via worker reset (Phase 3 baseline)

**Status:** Accepted
**Date:** 2026-03-03
**Deciders:** Corgiban maintainers

## Context

Phase 3 ships a baseline solver worker runtime with strict protocol validation and deterministic
UI behavior. The current worker solve path is synchronous once `solve(...)` starts, so a
main-thread cancel request cannot preempt an in-flight run without either:

- introducing a dedicated cancel protocol message plus interruptible worker execution, or
- terminating the worker process and recreating it.

The project needs cancellation that is immediately visible to users and keeps main-thread
orchestration simple for the baseline phase.

## Decision

- Protocol v2 baseline supports `SOLVE_START` and `PING` as inbound messages; it does not include
  `SOLVE_CANCEL`.
- `createSolverClient.cancel(runId)` handles in-flight cancellation by:
  - rejecting the pending run with `SolverRunCancelledError`,
  - terminating the current worker,
  - recreating a fresh worker instance,
  - resetting worker health to `idle`.
- App workflows that invalidate solver context (for example level changes) must cancel the active
  run before resetting solver run state so stale runs cannot block subsequent solves.
- Worker-pool cancellation remains queue-only (`WorkerPool.cancel(runId)` removes queued tasks
  and does not interrupt active tasks).
- `SOLVE_CANCEL` remains reserved for a future protocol extension when interruptible in-flight
  execution is implemented.

## Consequences

**Positive:**

- User cancellation is immediate and deterministic at the app boundary.
- No ad-hoc cancel message shape is introduced into protocol v2.
- Worker crash/retry/cancel semantics share one reset path, reducing edge-case drift.

**Negative:**

- In-flight cancellation restarts the worker, which adds startup overhead.
- Any in-worker transient state is discarded on cancel.
- Cooperative cancel-token checks inside solver algorithms are not used for worker in-flight
  cancellation in this phase.

## Alternatives considered

- Add `SOLVE_CANCEL` immediately and thread a cancel token through worker runtime.
- Allow runs to continue and ignore late results (no true cancellation).
- Use `SharedArrayBuffer`/`Atomics` style coordination (rejected by repo policy).

## Rollout plan (if applicable)

- Keep worker protocol v2 validation strict and treat `SOLVE_CANCEL` as invalid inbound.
- Keep cancellation behavior centralized in solver client reset logic.
- Revisit protocol-level in-flight cancellation in a future phase and supersede this ADR if
  adopted.

## Testing plan

- Solver client tests verify cancel rejects pending runs and recreates workers.
- Worker runtime tests verify `SOLVE_CANCEL` is rejected as invalid for protocol v2.
- App thunk/slice tests verify cancel flow and worker-health transitions.

## Links

- `docs/Architecture.md` (sections 7.2 and 7.4)
- `docs/project-plan.md` (Phase 3 and worker requirements)
- `docs/adr/0003-worker-protocol-versioning-validation.md`
