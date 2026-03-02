# ADR 0003: Worker protocol versioning and validation strategy

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

Solver and benchmark execution run off-main-thread. Message contracts between main thread and
workers must be stable, explicit, and safe against schema drift.

## Decision

- Every worker message includes `protocolVersion` and `runId`.
- Message schemas are validated on both sides using shared protocol definitions.
- Unknown fields and mismatched versions are rejected with explicit errors.
- Protocol shape changes require versioned updates, not ad-hoc JSON evolution.
- Worker payloads are transferred via structured-clone postMessage. Typed array fields
  (for example `staticGrid` and `initialBoxes`) must not be JSON-stringified.
- `algorithmId` in `SOLVE_START` is always a concrete resolved value (e.g. `'bfsPush'`, `'astarPush'`). Resolution via `analyzeLevel`/`chooseAlgorithm` happens on the main thread before dispatch. The worker protocol never carries `'auto'` or any unresolved value.

## Consequences

- Positive: Safer upgrades and clearer compatibility behavior.
- Positive: Better diagnostics for malformed messages.
- Negative: Protocol changes require coordinated updates across worker and client.
- Negative: Slight runtime validation overhead.

## Alternatives considered

- Unversioned messages with best-effort parsing.
- TypeScript-only compile-time typing without runtime validation.
- Independent schema definitions in worker and app layers.

## Rollout plan (if applicable)

- Phase 3 introduces protocol schemas and runtime validation.
- Future protocol evolution increments version and keeps compatibility rules explicit.

## Testing plan

- Validate request and response schema tests for valid/invalid payloads.
- Add regression tests for version mismatch handling.
- Add cancellation/progress path tests using deterministic message simulation.

## Links

- Related docs: `docs/Architecture.md` (sections 3.3, 7), `docs/project-plan.md` (Phase 3)
- Related issues/PRs: N/A (initial architecture baseline)
