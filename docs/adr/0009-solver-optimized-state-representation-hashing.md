# ADR 0009: Solver-optimized state representation and hashing

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Corgiban maintainers

## Context

Solver throughput is dominated by:

- the number of expanded states
- the cost of generating successors
- the cost of membership checks in visited / transposition tables
- the cost of occupancy and reachability queries used by move generation and heuristics

The gameplay `GameState` includes history and stats intended for UI/undo, which adds memory and
allocation overhead if used directly by the solver. Phase 1's core is designed for correctness
and determinism, not for large-scale search throughput.

The solver plan uses a push-based model (treating walking within a region as "free"), which
enables canonicalization of the player position within a reachable region to reduce the state
space. This canonicalization is only valid under a push-cost model and must be explicit.

String-based keys are too allocation-heavy for large search trees and increase GC pressure.
We need a solver-specific representation that is minimal, deterministic, and fast to hash.

This decision interacts with:

- ADR-0004 (push-based solver model)
- Determinism and no-DOM constraints (LLM_GUIDE.md)
- External format compatibility constraints (standards landscape and edge-case variants)

## Decision

Introduce a solver-specific representation and precomputed solver-only static data, separate
from gameplay `GameState`.

Cost model clarity:

This ADR applies to push-cost search (each push has cost 1; player walking between pushes is not
part of state cost). If we later support move-optimal search (walking steps counted), we will
introduce a separate state identity that preserves player position (or otherwise models
walking-cost deltas) rather than using player-region canonicalization.

Static data: `CompiledLevel`

Add a solver-only `CompiledLevel`, derived from `LevelRuntime`, with precomputations needed for
fast successor generation and heuristics:

- Cell compaction:
  Build a mapping from global grid indices to a compact cellId space containing only walkable
  or meaningful cells (for example, floor/target cells). Store globalIndex -> cellId (or -1)
  and cellId -> globalIndex. All solver bitsets and neighbor tables are defined over cellId
  space (not 0..width\*height).
- Neighbor table:
  `next[cellId][dir] -> cellId | -1` (in compact space).
- Static bitsets:
  `isWall`, `isGoal` in compact space (as bitsets or tight typed arrays).
  Additional derived sets as needed (for example, pushable adjacency).
- Dead squares:
  Precompute locations where a box can never reach any goal (at minimum, static dead squares;
  expanded deadlock pruning can build on this later).
- Goal distance tables:
  Precompute distances used by admissible heuristics (for example, per-cell distance to each
  goal, or a goal-indexed distance map).

Dynamic data: `SolverState`

Add a minimal solver node representation with deterministic normalization:

- Boxes list (canonical):
  Store box positions as a sorted `Uint16Array` (or `Uint32Array` if needed) of compact cellIds.
  Sorting is part of the state normalization contract.
- Occupancy:
  Use an occupancy bitset over compact cellIds for O(1) collision checks and reachability
  flood-fills. Visited/transposition entries must not require storing a full occupancy bitset
  per retained state unless proven acceptable by memory profiling.
  Preferred: compute occupancy ephemerally during expansion from the canonical boxes list, or
  store occupancy only in short-lived node objects. If persistent occupancy storage is ever
  adopted, it must be the compact-space bitset (not a 64x64 global bitset).
- Canonical player:
  The player position stored in a solver state is the canonical representative of the player's
  reachable region given the current box occupancy.
  Canonical rule: `playerCanonical = minimum reachable cellId` in the reachable set
  (deterministic). Reachable set is computed by flood-fill on the compact graph using the
  occupancy bitset.
- Hash key:
  Store a 64-bit Zobrist key, either as `bigint` (preferred for clarity) or `{ hi: uint32,
lo: uint32 }` for portability/perf tuning. Zobrist table generation must be deterministic
  (seeded PRNG or stable hash-based generator). `Math.random()` is not allowed.

Hashing policy: visited / transposition tables

- Visited and transposition tables use numeric Zobrist keys as the primary index.
- Collision safety: on Zobrist key match, equality is verified by comparing a compact state
  fingerprint: canonical player id + canonical sorted boxes list (or a packed equivalent).
- String keys are not used in solver search paths except for debug-only diagnostics when
  explicitly enabled.

Separation of concerns:

- Gameplay `GameState` remains unchanged and continues to power UI, undo/history, and
  correctness checks.
- The solver operates on `CompiledLevel` + `SolverState` and does not depend on gameplay-only
  fields.

## Consequences

**Positive:**

- Lower per-node allocation and reduced GC pressure (numeric keys, minimal state).
- Faster membership checks in visited / transposition tables.
- Reduced state count via player-region canonicalization (push-cost search).
- Clear separation of gameplay vs solver optimization concerns.

**Negative:**

- Additional compilation step (LevelRuntime -> CompiledLevel) and solver-only memory overhead.
- More complex solver data model (compaction, bitsets, canonicalization rules).
- Requires careful implementation discipline: deterministic Zobrist generation,
  canonicalization correctness, and collision verification.

## Alternatives considered

- Use gameplay `GameState` directly in solver algorithms.
- Keep string-based hashing and linear scans for occupancy.
- Store only a boxes list (no occupancy structure).
- Use 32-bit hashes only and accept higher collision risk.
- Store exact player position (no reachable-region canonicalization) even under push-cost search.

## Rollout plan (if applicable)

- Implement `CompiledLevel` and `SolverState` (and constructors) in `packages/solver`.
- Add deterministic Zobrist table generation utilities.
- Migrate solver visited / transposition tables to numeric Zobrist keys with collision
  verification.
- Keep core gameplay state unchanged.
- Add cross-check tests between solver transitions and core engine behavior for shared semantics
  (for example, push legality and win detection).

## Testing plan

- Canonicalization tests:
  Different player positions within the same reachable region normalize to the same canonical
  player id. Recompute canonicalization after pushes; ensure stability/determinism.
- Zobrist determinism:
  Same level compilation yields identical Zobrist tables across runs. Incremental updates match
  full recomputation (boxes moved, player region changes).
- Collision verification:
  Table lookup on key match verifies full fingerprint equality. Negative tests ensure mismatched
  fingerprints do not alias.
- Occupancy correctness:
  Occupancy reflects boxes list (no missing / extra bits). Reachability flood-fill respects
  occupancy and walls.
- Regression fixtures:
  Small fixture levels with known push sequences and known solutions; confirm solver results
  remain correct and stable.
- Performance sanity:
  Microbenchmarks for hashing and successor generation (guard against accidental string
  allocations in hot paths).

## Links

- `docs/Architecture.md` section 8
- `docs/project-plan.md` Phase 8
- `docs/adr/0004-push-based-solver-model.md`
