# ADR 0015: Worker progress light-validation mode

**Status:** Accepted
**Date:** 2026-03-04
**Deciders:** Corgiban maintainers

## Context

Protocol validation is required at runtime on both sides of the worker boundary (ADR-0003).
During benchmark and solve runs, `SOLVE_PROGRESS` can be emitted at high frequency. Full schema
validation of every progress payload adds avoidable overhead on hot paths, while structural
messages (`SOLVE_START`, results, errors, lifecycle messages) are lower frequency and remain
high-risk if validation weakens.

## Decision

- Keep strict schema validation as the default for all outbound and inbound messages.
- Add an optional outbound validation mode: `light-progress`.
- `light-progress` is scoped to `SOLVE_PROGRESS` only and validates required structural fields:
  `type`, `runId`, `protocolVersion`, `expanded`, `generated`, `depth`, `frontier`, `elapsedMs`,
  and optional `bestHeuristic` / `bestPathSoFar` types.
- All non-`SOLVE_PROGRESS` messages continue through strict schema validation.
- Protocol shape/version is unchanged (`PROTOCOL_VERSION` remains `2`).

## Consequences

**Positive:**

- Reduces validation overhead on high-frequency progress streams.
- Preserves strict validation for structural contracts and failure paths.
- Avoids protocol-version churn for a runtime-only validation-path optimization.

**Negative:**

- Validation behavior now depends on mode selection in callers.
- Light mode is intentionally narrower than full schema checks and must remain tightly scoped.

## Alternatives considered

- Keep strict schema validation for all messages at all times.
- Disable runtime validation for progress messages entirely.
- Introduce a protocol-v3 progress payload dedicated to lightweight parsing.

## Rollout plan (if applicable)

- Add `OutboundValidationMode = 'strict' | 'light-progress'` in protocol validation helpers.
- Use `light-progress` only on hot progress paths where profiling justifies it.
- Keep strict mode as the default in app adapters; enable `light-progress` explicitly
  (`apps/web`: `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1`) for targeted profiling or rollout.
- Keep all structural message paths on strict validation.
- Keep strict mode as the runtime default unless profiling data shows clear benefit for enabling
  `light-progress` in specific call sites.

## Testing plan

- Unit tests for `validateOutboundMessage(..., { mode: 'light-progress' })`:
  - accepts valid `SOLVE_PROGRESS` payloads, including extra non-structural fields
  - rejects malformed required fields
  - keeps non-progress messages strict (unknown fields rejected)
- Regression tests for strict-mode behavior unchanged.

## Links

- `docs/adr/0003-worker-protocol-versioning-validation.md`
- `docs/adr/0014-benchmark-worker-cancellation-semantics.md`
- `docs/Architecture.md` (section 7.3)
- `docs/_generated/analysis/phase-04-protocol-validation-profile.md`
