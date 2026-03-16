---
id: DEBT-023
title: expandSolution uses linear indexOf for box lookup on every push
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

`expandSolution` (`packages/solver/src/solution/expandSolution.ts` line 174) uses
`boxes.indexOf(boxIndex)` to find which slot holds the pushed box. This is O(boxes) per push,
making solution expansion O(pushes \* boxes).

## Expected

Use an indexed structure (reverse index map: `cellId -> slot`) to make box lookup O(1) per
push, reducing expansion to O(pushes).

## Actual

Linear scan via `indexOf` on every push step.

## Notes

Only affects solution reconstruction after search completes, not the search itself. For short
solutions this is immaterial; for long solutions on large levels it could be noticeable.
Profile before optimizing.

## Fix Plan

Build a reverse index `Map<cellId, slotIndex>` before the push loop and update it alongside
the boxes array on each push. Add regression coverage for long solutions.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
