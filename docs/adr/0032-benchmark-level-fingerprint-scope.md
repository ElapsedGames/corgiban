# ADR 0032: Benchmark level fingerprint scope

**Status:** Proposed
**Date:** 2026-03-12
**Deciders:** Corgiban maintainers

## Context

ADR-0031 introduced browser-local playable refs for exact runnable identity and added local-only
benchmark metadata so `/bench` can reopen session-backed levels safely. The current local reopen
and comparison fingerprint uses a compact deterministic key derived from a stable canonical
serialization of the committed `LevelDefinition` payload.

That current behavior is intentional and correct for the route-handoff fix:

- it is not based on raw Lab textarea input
- it is not sensitive to object key order
- it is not derived from UI display state
- it is strict enough to avoid reopening newer content under an older benchmark result

However, the current fingerprint is payload-level canonical, not parsed-structure canonical. It
includes fields such as `id`, `name`, and `knownSolution` in addition to the board rows. That means
two semantically identical committed levels can still compare as different if only metadata
changes.

That tradeoff is acceptable for ADR-0031 and should remain unchanged in the current PR. This ADR
records a possible follow-on refinement so reviewers do not treat the current fingerprint scope as
an accidental omission.

## Decision

- Keep the current benchmark fingerprint behavior from ADR-0031 for now.
- Treat any refinement from payload-level canonical fingerprints to parsed-structure canonical
  fingerprints as deferred work, not part of the current handoff/identity PR.
- If the project later decides that benchmark reopen/comparison identity should mean "same playable
  board/body" rather than "same committed level payload", the fingerprint should:
  - be derived from a canonicalized board/body representation after parse-normalization
  - exclude presentation-oriented or non-structural metadata such as `name`
  - exclude `knownSolution`
  - explicitly decide whether canonical/display `id` remains part of the fingerprint
- Any such change must remain local to browser-side reopen/comparison logic unless a separate ADR
  changes a public export/import contract.

## Consequences

**Positive:**

- The current PR stays scoped to the identity/handoff architecture fix.
- Reviewers have an explicit record that the current fingerprint semantics are deliberate.
- Future work has a defined direction if stricter board-equivalence semantics become important.

**Negative:**

- Current benchmark reopen/comparison may mark a result unavailable after metadata-only changes to a
  browser-local session entry.
- A later refinement will need careful regression coverage so it does not weaken the safety
  guarantee against reopening newer content under an older result.

## Alternatives considered

- Change the fingerprint semantics immediately in ADR-0031 scope
- Keep the current behavior without documenting the deferred refinement
- Use raw authored text as the fingerprint source

## Rollout plan

- No implementation change in the current PR.
- Revisit this ADR only if product expectations shift from "same committed payload" to "same board
  semantics".
- If adopted later, update ADR-0031 references, architecture docs, and bench reopen/comparison
  tests together.

## Testing plan

- No new runtime tests for this ADR by itself because it is deferred work.
- If adopted later, add regression coverage for:
  - metadata-only changes that should continue to reopen/compare as the same board input
  - parsed-format normalization equivalence
  - preserving unavailable-state behavior when the actual board/body changed

## Links

- `docs/adr/0031-session-playable-refs-and-atomic-route-handoff.md`
- `docs/Architecture.md`
- `docs/project-plan.md`
