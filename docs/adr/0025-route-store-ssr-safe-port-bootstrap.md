# ADR 0025: SSR-safe route store bootstrap via mutable ports

**Status:** Accepted
**Date:** 2026-03-06
**Deciders:** Corgiban maintainers

## Context

`/play` and `/bench` use route-scoped Redux stores, and their thunks depend on `SolverPort`,
`BenchmarkPort`, and `PersistencePort`. Those ports ultimately create browser-only resources such as:

- module workers
- IndexedDB-backed persistence adapters
- browser event subscriptions

Creating those resources during route render is unsafe for Remix SSR and violates the repo rule that
browser-only resources must not be created before commit. However, delaying store creation until an
effect runs would create a separate problem:

- route components would render once without a usable store
- store identity could churn across hydration/mount
- thunk extra-argument injection would become conditional or ad-hoc

We need one stable route-store bootstrap pattern that keeps render pure while still letting the
store own workflow orchestration and cleanup.

## Decision

- `/play` and `/bench` create their route-scoped Redux stores during render.
- Those stores receive mutable wrapper ports initialized with no-op implementations.
- After commit, the route module replaces the wrapper contents with browser-backed ports.
- Route unmount swaps the wrappers back to no-op ports, which disposes the browser-backed
  implementations through the wrapper replacement contract.
- The store instance stays stable across SSR and hydration; route modules replace ports, not the
  store object.
- `/lab` remains out of this pattern because ADR-0023 keeps it in route-local React state with
  direct port refs instead of Redux ownership.

## Consequences

**Positive:**

- Keeps route render and SSR pure: no worker or persistence creation during render.
- Preserves one stable store instance per route across hydration/mount.
- Keeps thunk wiring explicit because thunks still depend on port interfaces from store creation.
- Centralizes browser-resource cleanup in route ownership and mutable-port replacement.

**Negative:**

- Adds mutable wrapper indirection around ports.
- Route modules must follow the replace/dispose lifecycle carefully.
- Debugging port ownership now requires understanding both the wrapper and the concrete adapter.

## Alternatives considered

- Create browser-backed ports during render behind `typeof document !== 'undefined'`.
- Delay store creation until `useEffect()` and render a temporary shell first.
- Use one global app store for all routes so browser resources are initialized elsewhere.

## Rollout plan (if applicable)

- Keep mutable port wrappers in `apps/web/app/state/mutableDependencies.ts`.
- Use the pattern for route-scoped Redux stores that need browser resources.
- If future route ownership moves to a shared/global store, supersede this ADR with the new
  lifecycle contract instead of silently changing bootstrap behavior.

## Testing plan

- Route tests verify `/play` and `/bench` can render before browser-backed ports are attached.
- Mutable-port tests verify replacement, worker-health subscription forwarding, and disposal.
- Route lifecycle tests verify browser-backed ports are disposed when the route unmounts.

## Links

- `docs/Architecture.md` (sections 3.22 and 12.2)
- `docs/project-plan.md` (Phase 6 deferred notes)
- `LLM_GUIDE.md`
- `apps/web/README.md`
- `apps/web/app/state/mutableDependencies.ts`
