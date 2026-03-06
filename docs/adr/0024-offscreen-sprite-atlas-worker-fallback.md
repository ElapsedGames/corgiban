# ADR 0024: Offscreen sprite-atlas worker with main-thread fallback

**Status:** Accepted
**Date:** 2026-03-06
**Deciders:** Corgiban maintainers

## Context

Phase 6 adds sprite-atlas pre-rendering for the canvas board so repeated draws do less per-frame
setup work, especially on higher-DPR displays. The repo already keeps gameplay rendering
deterministic through the `buildRenderPlan(...)` + `draw(...)` split (ADR-0005), but atlas
generation itself can still be expensive enough to compete with UI work if it always happens on
the main thread.

Browser support for `OffscreenCanvas`, workers, and `ImageBitmap` is uneven, so the renderer needs
an optimization path that improves capable browsers without turning atlas generation into a hard
runtime requirement or a new worker-protocol concern.

## Decision

- Keep sprite-atlas generation as an app-owned rendering adapter in `apps/web/app/canvas`.
- When `Worker`, `OffscreenCanvas`, and `ImageBitmap` are available, request atlases from a
  dedicated auxiliary worker keyed by `(cellSize, dpr)`.
- Cache ready atlases lazily on demand and keep the cache intentionally small; atlas lifecycle is
  reference-counted so bitmaps can be closed after eviction or release.
- If capability detection fails, worker boot fails, or atlas generation returns an invalid message,
  fall back to the existing main-thread canvas draw path.
- Do not route sprite-atlas work through `packages/worker` or the solver/benchmark protocol. This
  optimization remains local to the web renderer and does not change domain or protocol contracts.

## Consequences

**Positive:**

- Keeps heavy atlas preparation off the main thread when the browser supports it.
- Preserves deterministic rendering because `buildRenderPlan(...)` and `draw(...)` remain the
  canonical rendering contract.
- Avoids protocol churn and keeps sprite rendering concerns out of solver/benchmark workers.

**Negative:**

- Adds browser-capability branching and an extra worker lifecycle to test and maintain.
- Requires careful bitmap cleanup to avoid leaking large image resources.
- Fallback behavior must remain correct because OffscreenCanvas support is not universal.

## Alternatives considered

- Keep all sprite-atlas generation on the main thread.
- Move sprite-atlas work into `packages/worker` or the versioned solver/benchmark protocol.
- Pre-bundle static raster atlases for a fixed DPR/cell-size matrix instead of generating them.

## Rollout plan (if applicable)

- Keep the auxiliary worker best-effort and app-owned in `apps/web`.
- Retain the main-thread draw path as the required fallback.
- Revisit only if later rendering phases require a materially different asset pipeline or shared
  worker contract.

## Testing plan

- Unit tests for capability detection, cache eviction, retain/release cleanup, and worker-message
  validation.
- `GameCanvas` tests covering both atlas and no-atlas render paths.
- Draw tests proving the main-thread fallback path remains functional.

## Links

- `docs/Architecture.md` (sections 3.21, 6, 10.2)
- `docs/project-plan.md` (Phase 6 task 4)
- `apps/web/README.md`
