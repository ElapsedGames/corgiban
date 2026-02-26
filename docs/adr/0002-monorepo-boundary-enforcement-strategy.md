# ADR 0002: Monorepo and package boundary enforcement strategy

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

Core logic, solvers, worker runtime, and app adapters evolve at different speeds. The project needs
strict dependency direction to prevent architecture drift and accidental cross-layer coupling.

## Decision

- Use a `pnpm` workspace monorepo.
- Keep package import direction explicit (`core`, `solver`, `worker`, `benchmarks`, `apps/web`).
- Enforce boundaries through:
  - TypeScript project references
  - package `exports` public entrypoints
  - ESLint boundary rules
  - dependency-cruiser validation
- Keep `boundary-rules.mjs` as the single source for boundary intent.

## Consequences

- Positive: Boundary violations are detected early and consistently.
- Positive: Domain packages remain reusable outside the Remix app.
- Negative: Initial config overhead is higher than a single-package setup.
- Negative: Contributors must learn and follow explicit package boundaries.

## Alternatives considered

- Single-package repository with folder-level conventions only.
- Monorepo without hard enforcement (convention-only boundaries).
- Separate repositories per subsystem.

## Rollout plan (if applicable)

- Phase 0 sets workspace structure and boundary enforcement.
- Later phases keep changes additive and boundary-compliant.

## Testing plan

- Verify boundary violations fail lint/typecheck.
- Verify deep imports fail through package entrypoint constraints.
- Verify dependency graph checks stay aligned with boundary rules.

## Links

- Related docs: `docs/Architecture.md` (sections 3.1, 4.1), `docs/dev-tools-spec.md`
- Related issues/PRs: N/A (initial architecture baseline)
