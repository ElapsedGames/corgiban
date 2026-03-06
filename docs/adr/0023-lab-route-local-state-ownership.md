# ADR 0023: Level Lab route-local state ownership and direct port orchestration

**Status:** Accepted
**Date:** 2026-03-06
**Deciders:** Corgiban maintainers

## Context

Phase 6 introduces `/lab` as an authoring/debugging surface with:

- format-specific input text and normalization
- local preview gameplay state
- one-click solve/bench checks through worker ports
- versioned JSON import/export

`/play` and `/bench` already use route-scoped Redux stores with injected ports. Extending those
stores for `/lab` would pull draft editor state, parser feedback, and single-run tool status into
global state before cross-route handoff requirements are defined. That would increase slice/API
surface and create churn ahead of the planned Phase 7 route-responsibility pass.

## Decision

- Keep `/lab` state route-local in `LabPage`.
- Store authored input, parsed level metadata, preview `GameState`, and single-run solve/bench
  status in local React state/refs instead of adding a `labSlice`.
- Create/dispose `SolverPort` and `BenchmarkPort` directly inside the route component.
- Guard async worker callbacks with a route-local token (`runId` + authored revision) so stale
  solve/bench results are ignored after parse/import/cancel transitions.
- Revisit store ownership only when a concrete cross-route workflow requires shared state, and
  capture that change in a new ADR.

## Consequences

**Positive:**

- Keeps `/lab` isolated from gameplay and persisted benchmark workflows.
- Avoids adding unstable draft/editor state to the shared Redux contract too early.
- Makes route unmount cleanup explicit because the route owns its worker ports directly.
- Keeps tests focused at the route/component level for parser, keyboard, and worker-check flows.

**Negative:**

- `/lab` does not automatically participate in cross-route store sharing.
- Future handoff flows (`/lab` -> `/play` or `/bench`) may require a later migration to shared
  state or explicit payload passing.
- Route-local orchestration means some patterns differ from `/play` and `/bench`, so docs must keep
  that distinction clear.

## Alternatives considered

- Add a `labSlice` to the shared Redux store now.
- Reuse `/play` or `/bench` slices for Level Lab concerns.
- Persist authored lab state immediately instead of keeping it route-local.

## Rollout plan (if applicable)

- Keep `/lab` route-local through the Phase 6 implementation.
- Document the ownership model in architecture, app README, and guide docs.
- Reevaluate in Phase 7 only if route handoff workflows require shared ownership.

## Testing plan

- Route/component tests for `LabPage` parse/import/export flows.
- Keyboard control tests for preview gameplay.
- Tests verifying solve/bench cancellation and stale-result guards after authored input changes.
- Route cleanup tests ensuring direct ports are disposed on unmount.

## Links

- `docs/Architecture.md` (sections 3.20, 11, 12)
- `docs/project-plan.md` (Phase 6 and Phase 7)
- `apps/web/README.md`
- `apps/web/app/lab/LabPage.tsx`
