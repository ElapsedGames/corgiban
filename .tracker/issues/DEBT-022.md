---
id: DEBT-022
title: BFS calls nowMs() on every node dequeue instead of coarse sampling
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

The BFS main loop in `packages/solver/src/algorithms/bfsPush.ts` (line 115) calls
`nowMs() - startMs` on every node dequeue to check time budgets.

## Expected

Sample `nowMs()` at a coarse interval (e.g., every 256 or 1024 nodes) to reduce per-node
overhead while preserving budget correctness within acceptable granularity.

## Actual

`nowMs()` called once per node dequeue unconditionally.

## Notes

`performance.now()` is relatively cheap (~tens of nanoseconds) but adds up at high node
throughput. Profile before optimizing to confirm materiality.

## Fix Plan

Add a node counter and only call `nowMs()` when `expanded % INTERVAL === 0`. Choose an
interval that keeps budget overshoot within acceptable bounds.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
