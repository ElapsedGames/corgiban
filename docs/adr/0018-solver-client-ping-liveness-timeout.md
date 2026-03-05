# ADR 0018: Solver client ping liveness and timeout semantics

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

Phase 5 adds solver-client liveness hardening. Prior behavior allowed ping checks to wait
indefinitely if the worker stopped responding, and ping did not explicitly protect against active
solve runs. That made health transitions and recovery behavior ambiguous in failure cases.

The protocol already defines lifecycle `PING`/`PONG` in v2 (ADR-0003). We need deterministic
client-side liveness semantics without introducing a new protocol version.

## Decision

- Keep protocol v2 unchanged (`PING`/`PONG` only; no message-shape changes).
- `createSolverClient().ping(timeoutMs?)` is an idle-only liveness check:
  - reject if a solve run is active
  - reject if another ping is already in flight
- `createSolverClient().solve(...)` rejects while a ping is in flight.
- Ping timeout behavior is deterministic:
  - missing/invalid/non-positive `timeoutMs` uses `DEFAULT_PING_TIMEOUT_MS` (`5_000`)
  - timeout transitions worker health to `crashed`
  - timeout/error terminates the current worker immediately
  - late `PONG` does not auto-recover worker health
- Recovery remains explicit via retry/reset paths.

## Consequences

**Positive:**

- Prevents hung liveness probes from masking worker failures.
- Keeps worker health transitions explicit and testable.
- Avoids ping/solve interleaving ambiguity by requiring idle-only pings.
- Preserves protocol compatibility by keeping v2 message contracts unchanged.

**Negative:**

- Ping cannot be used as an in-run heartbeat while a solve is active.
- Timeout can transition to `crashed` for transient stalls, requiring explicit retry.
- Adds stricter API behavior that callers must handle (`idle-only`, timeout rejection).

## Alternatives considered

- Allow unbounded ping waits (rejected: non-deterministic liveness state).
- Allow ping during active solves (rejected: introduces interleaving ambiguity with run traffic).
- Introduce a new protocol message/version for liveness hardening (rejected: unnecessary for this
  client-side behavior change).
- Mark timeout as degraded-but-healthy without reset (rejected: weaker recovery guarantees).

## Rollout plan (if applicable)

- Export `DEFAULT_PING_TIMEOUT_MS` from `@corgiban/worker`.
- Enforce idle-only and timeout semantics in `createSolverClient`.
- Update architecture and package docs for caller expectations.

## Testing plan

- Solver client tests verify:
  - ping rejection while a solve run is active
  - solve rejection while a ping is in flight
  - deterministic timeout rejection with `crashed` worker health and worker termination
  - default timeout fallback when `timeoutMs` is missing/invalid
  - late `PONG` does not reset `crashed` health

## Links

- `docs/Architecture.md` (sections 3.16 and 7.4)
- `docs/project-plan.md` (Phase 5 Task 5)
- `packages/worker/README.md`
- `docs/adr/0003-worker-protocol-versioning-validation.md`
