# ADR 0001: Remix-first app shell (Vite mode)

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

The project needs a stable app-shell choice before feature implementation starts. Delaying this
choice would create route-model churn and raise migration cost once workers, benchmarks, and state
ownership are in place.

## Decision

- `apps/web` uses Remix from Phase 0.
- Remix runs in Vite mode.
- Remix route modules and route boundaries are the primary app structure.
- Domain packages stay framework-agnostic and are consumed through package entrypoints.

## Consequences

- Positive: One routing/data model from day one; no SPA-to-Remix migration later.
- Positive: Clear client/server boundaries for worker creation and browser-only APIs.
- Negative: Early work must follow Remix conventions even during scaffolding.
- Negative: Slightly steeper setup for contributors unfamiliar with Remix.

## Alternatives considered

- Build a generic SPA first and migrate to Remix later.
- Use another app shell (for example Next.js) and adapt boundaries afterward.
- Keep a minimal single-page shell and defer framework selection.

## Rollout plan (if applicable)

- Phase 0 scaffolds `apps/web` as Remix in Vite mode.
- Phase 2 route work follows route-module ownership and route-level boundaries.

## Testing plan

- Verify `pnpm dev` starts the Remix app shell.
- Verify route modules and route-level boundaries in unit/component tests.
- Verify worker construction remains in client-only modules.

## Links

- Related docs: `docs/Architecture.md` (sections 3.8, 11.3), `docs/project-plan.md` (Phase 0)
- Related issues/PRs: N/A (initial architecture baseline)
