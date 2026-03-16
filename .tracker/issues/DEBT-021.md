---
id: DEBT-021
title: createSolverState double-allocates and sorts boxes on every child state
type: debt
severity: low
area: solver
regression: false
status: open
discovered_at: 2026-03-16
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

`createSolverState` (`packages/solver/src/state/solverState.ts` lines 26-46) allocates a new
`Uint16Array` via `Uint16Array.from(boxes)` and then sorts it on every call. This function is
called for every child state generated during BFS, making it a hot path.

## Expected

When the caller already maintains sorted boxes (e.g., BFS generating children from an
already-sorted parent), the sort is redundant.

## Actual

Every call allocates + sorts regardless of whether the input is already sorted.

## Notes

The allocation itself (`Uint16Array.from`) is necessary to avoid mutating the parent state.
The sort is the avoidable cost when the caller can guarantee order. Profile before optimizing.

## Fix Plan

Add an `alreadySorted?: boolean` parameter that skips the sort, or inline state construction
in algorithms that maintain sorted boxes as an invariant.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
