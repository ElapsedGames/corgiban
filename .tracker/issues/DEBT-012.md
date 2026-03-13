---
id: DEBT-012
title: analyzeLevel now pays compileLevel cost on the main thread
type: debt
severity: low
area: solver
regression: false
status: deferred
discovered_at: 2026-03-12
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

`packages/solver/src/api/selection.ts` now calls `compileLevel(...)` inside `analyzeLevel(...)` so
algorithm recommendation can inspect tunnel density. That adds goal-distance BFS work to
main-thread call sites in `apps/web`, including `/play` recommendation updates and `/lab` one-click
solve/bench orchestration.

## Expected

Recommendation analysis should stay cheap enough that route interaction remains responsive on the
main thread, or the heavier compiled data should be cached / moved off-thread when that budget is
at risk.

## Actual

Current call sites that run on the main thread include:

- `apps/web/app/state/solverThunks.ts`
- `apps/web/app/lab/useLabOrchestration.ts`

Those paths now pay for:

- `compileLevel(level)`
- `buildGoalDistances(...)`
- tunnel-direction derivation

The current code is still within an acceptable budget on the shipped catalog and max-size synthetic
levels, but the heavier work is now structurally on the UI thread and should be revisited before
larger imported levels or broader recommendation usage land.

## Repro

1. Trigger solver recommendation on `/play` by changing levels.
2. Trigger one-click solve or bench on `/lab`.
3. In browser profiling, inspect the `analyzeLevel(...)` stack and note that it now descends into
   `compileLevel(...)` and goal-distance construction on the main thread.

## Notes

- Current implementation references:
  - `packages/solver/src/api/selection.ts`
  - `packages/solver/src/state/compiledLevel.ts`
  - `apps/web/app/state/solverThunks.ts`
  - `apps/web/app/lab/useLabOrchestration.ts`
- Quick Node-side timing on 2026-03-12 did not reproduce a product-blocking regression:
  - built-in catalog worst case: about `0.075 ms` average per `analyzeLevel(...)` call
  - synthetic `64x64` / `40`-box level: about `1.668 ms` average per call
- That evidence lowers severity, but it is not a substitute for browser-main-thread profiling on
  low-end hardware.

## Fix Plan

- Profile `analyzeLevel(...)` in-browser on `/play` and `/lab`, including a throttled CPU run.
- If profiling shows meaningful UI-thread cost, cache compiled recommendation features per level id
  or split recommendation-specific tunnel analysis from full solver compilation.
- Keep any follow-up aligned with the repo rule that main-thread orchestration should stay
  responsive and heavy compute should move to workers when necessary.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
