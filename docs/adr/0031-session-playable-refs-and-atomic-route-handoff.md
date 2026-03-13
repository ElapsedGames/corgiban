# ADR 0031: Session-scoped playable refs and atomic cross-route handoff

**Status:** Accepted
**Date:** 2026-03-12
**Deciders:** Corgiban maintainers

## Context

Phase 7 route handoff work exposed three linked failures in the web app:

- `/play?levelId=...&algorithmId=...` could lose the requested algorithm because level activation
  and algorithm selection were split across separate effect paths.
- Edited built-in levels handed off from `/lab` or reopened from `/bench` could resolve back to the
  original built-in because `LevelDefinition.id` was being used as both canonical identity and exact
  runnable identity.
- `/lab` leaked route-local authoring state into the shared playable catalog by publishing a
  synthetic entry on mount or parse instead of only on explicit handoff.

The app needed one explicit identity model that kept built-ins backward-compatible while allowing
session-scoped authored variants to remain distinct runnable inputs across `/play`, `/lab`, and
`/bench`.

## Decision

- Introduce an app-local playable-entry contract in `apps/web/app/levels`:
  - `PlayableEntry = { ref, source, level }`
  - `ref` is the exact runnable identity for the current browser session
  - `level.id` remains the canonical/display identity only
- Use deterministic built-in refs and opaque session refs:
  - built-ins: `builtin:<levelId>`
  - session/authored/imported entries: `temp:<opaque-session-id>`
- Add additive route support for `levelRef`:
  - `levelRef` is the exact runnable identity
  - `levelId` remains the legacy canonical fallback for backward compatibility
  - resolution order is exact `levelRef` first, legacy `levelId` second
  - legacy fallback may resolve a unique session entry, but must not guess between multiple session
    entries with the same canonical id
- `/play` route activation is atomic:
  - resolve the requested playable entry once
  - cancel active solve/replay state
  - swap active runtime and active playable ref
  - recompute the solver recommendation
  - apply a valid requested algorithm override once, in the same activation flow
- `/lab` remains route-local and does not auto-publish:
  - mount, parse, and normal committed draft changes do not mutate the shared playable catalog
  - only explicit actions such as `Open in Play` and `Send to Bench` publish or refresh a session
    entry
  - a Lab session reuses its published session ref across later edits
  - Lab bootstraps from a full playable entry so session-backed edits continue on the same exact
    authored identity
- `/bench` uses playable refs as execution identity:
  - suites run against playable refs, not canonical ids
  - history rows keep display `levelId` and `levelName` separately from exact reopen metadata
  - local-only metadata stores exact reopen refs and comparison fingerprints
  - public benchmark export/import adds additive `runnableLevelKey` and `comparisonLevelKey`
    fields for exact reopen plus cross-session comparison/fingerprinting while still stripping
    exact session reopen metadata
  - public level-pack export/import remains canonical-only in the current schema; unsupported
    same-`level.id` authored/session variants are rejected instead of being deduplicated silently

## Consequences

**Positive:**

- Edited built-ins, imported levels, and built-ins can coexist without canonical-id shadowing.
- `/play` level + algorithm handoffs become deterministic instead of effect-order dependent.
- `/lab` route ownership remains explicit: authoring state is local until the user chooses to share
  it with `/play` or `/bench`.
- `/bench` can reopen or compare authored variants without collapsing them into the original
  built-in level.
- Old `?levelId=` links for built-ins keep working.

**Negative:**

- Web routes and bench history now carry both canonical identity (`level.id`) and exact runnable
  identity (`levelRef`/`ref`), which adds adapter-level complexity.
- Session-backed reopen links are intentionally browser-session scoped; after the session entry is
  gone, the UI must surface an unavailable state instead of silently falling back.
- Local alpha temp/session storage may be invalidated across incompatible releases instead of
  migrated forward.
- Local persistence still carries app-only exact reopen metadata that must stay out of public
  exports.

## Alternatives considered

- Derived canonical ids for edits such as `--lab-edit`
- Canonical-id shadowing where temporary entries replace built-ins
- Fixing `/play` by re-running the algorithm effect after level changes
- Keeping `/lab` auto-publish behavior and trying to patch its downstream consequences

## Rollout plan

- Migrate the web playable catalog to `PlayableEntry` refs and invalidate incompatible legacy
  temp/session storage instead of migrating it.
- Update `/play`, `/lab`, and `/bench` route handoff helpers to support `levelRef` additively.
- Add an additive public benchmark comparison key while keeping exact session reopen metadata local.
- Keep public level-pack export/import canonical-only and reject unsupported authored/session
  variants.
- Document the contract in architecture, app README, and project-plan notes.

## Testing plan

- Catalog tests for exact ref lookup, canonical fallback, ambiguity rejection, and builtin-only SSR
  snapshots
- `/play` tests for combined level + algorithm handoff, apply-once semantics, invalid algorithm
  fallback, and algorithm-only route changes
- `/lab` tests proving that publish only happens on explicit handoff actions and session refs are
  reused across edits
- `/bench` tests for exact reopen links, unavailable-state degradation, and comparison identity for
  edited built-ins
- Persistence/export tests for local-only metadata stripping, additive public comparison keys, and
  legacy-storage invalidation

## Links

- `docs/Architecture.md`
- `docs/project-plan.md`
- `apps/web/README.md`
- `docs/adr/0023-lab-route-local-state-ownership.md`
- `docs/adr/0025-route-store-ssr-safe-port-bootstrap.md`
