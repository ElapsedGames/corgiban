# ADR 0004: Push-based solver model

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

Sokoban search space grows rapidly with step-based transitions. The solver needs an action model
that keeps branching manageable while preserving deterministic playback output.

## Decision

- Solver graph edges are push transitions (macro actions), not single player steps.
- Reachability is computed between pushes to determine legal push candidates.
- Solver output is expanded to canonical `UDLR` move strings for playback.

## Consequences

- Positive: Smaller branching factor and better practical performance.
- Positive: Aligns with common Sokoban solver strategies and deadlock pruning.
- Negative: Requires macro-to-step expansion logic for playback.
- Negative: Requires careful state hashing and reachability bookkeeping.

## Alternatives considered

- Step-based graph search over every player move.
- Hybrid model with mixed step and push edges.
- Planning-only macro output without step expansion.

## Rollout plan (if applicable)

- Phase 3 baseline solver uses push-based BFS.
- Later algorithms (A*, IDA*) keep the same action model and API contracts.

## Testing plan

- Unit tests for legal push generation and reachability.
- Fixture tests proving solver correctness on small levels.
- Regression tests for deadlock/pruning behavior.

## Links

- Related docs: `docs/Architecture.md` (sections 3.4, 8), `docs/project-plan.md` (Phase 3)
- Related issues/PRs: N/A (initial architecture baseline)
