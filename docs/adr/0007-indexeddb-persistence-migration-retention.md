# ADR 0007: Persistence model (IndexedDB stores, migration policy, retention)

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

Benchmark results must persist across reloads and remain comparable over time. Persistence changes
must support schema evolution and bounded local storage usage.

## Decision

- Persist benchmark runs in IndexedDB.
- Keep `DB_VERSION` and benchmark data model contracts in `packages/benchmarks`.
- Keep IndexedDB migration logic in the `apps/web` persistence adapter.
- Retention policy defaults to 100 stored runs (configurable) with a clear-storage action.
- Persist enough metadata (solver options and environment snapshot) for run comparability.

## Consequences

- Positive: Durable local storage with explicit schema evolution path.
- Positive: Bounded storage growth through retention policy.
- Negative: Migration logic must be tested and maintained as schema evolves.
- Negative: Slightly higher implementation complexity than simple key-value storage.

## Alternatives considered

- `localStorage` only, with no schema migration model.
- Unlimited retention with manual cleanup.
- Ad-hoc migrations without explicit `DB_VERSION` ownership.

## Rollout plan (if applicable)

- Phase 4 introduces schema, adapter, and migration tests.
- Future schema changes require version bump and migration coverage updates.

## Testing plan

- Unit tests for upgrade paths across schema versions.
- Retention-policy tests for cap enforcement and clear action behavior.
- Integration tests verifying persisted benchmark comparability metadata.

## Links

- Related docs: `docs/Architecture.md` (section 9.2), `docs/project-plan.md` (Phase 4)
- Related issues/PRs: N/A (initial architecture baseline)
