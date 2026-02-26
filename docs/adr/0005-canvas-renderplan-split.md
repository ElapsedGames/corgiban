# ADR 0005: Canvas rendering testability via RenderPlan split

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

Canvas rendering is imperative and hard to test directly. The project needs deterministic, unit-
testable rendering logic without relying on brittle pixel snapshots.

## Decision

- Split rendering into:
  - `buildRenderPlan(state): RenderPlan` as pure deterministic logic
  - `draw(ctx, plan)` as a thin imperative adapter
- Unit tests target `buildRenderPlan`.
- `draw` stays minimal and does not carry core rendering logic.

## Consequences

- Positive: High-confidence tests without expensive image snapshot baselines.
- Positive: Rendering behavior remains deterministic and easier to review.
- Negative: Extra abstraction layer between state and draw calls.
- Negative: Requires disciplined separation to keep logic out of `draw`.

## Alternatives considered

- Test `draw` directly with pixel snapshot baselines.
- Keep rendering in one mixed imperative function.
- Drive rendering assertions only through end-to-end tests.

## Rollout plan (if applicable)

- Phase 2 introduces the `RenderPlan` split and tests.
- Future rendering changes preserve the same split responsibilities.

## Testing plan

- Unit tests for known `GameState` to `RenderPlan` mappings.
- Deterministic ordering assertions for render-plan output.
- Small integration checks for `draw` invocation paths.

## Links

- Related docs: `docs/Architecture.md` (section 10.2), `docs/project-plan.md` (Phase 2)
- Related issues/PRs: N/A (initial architecture baseline)
