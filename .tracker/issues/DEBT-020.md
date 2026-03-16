---
id: DEBT-020
title: Replay controller tests rely on hardcoded action type strings
type: debt
severity: low
area: ui
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

`apps/web/app/replay/__tests__/replayController.test.ts` matches dispatched actions by
hardcoded type strings (`'solver/setReplayTotalSteps'`, `'solver/setReplayIndex'`,
`'solver/setReplayState'`). These strings are not imported from constants - they are
duplicated inline across ~20 test cases.

## Expected

Tests should import action creators or type constants from the slice, or (better) test via
callback props once DEBT-019 decouples the controller from Redux.

## Actual

Hardcoded strings throughout the file. If the slice name or action names change, all tests
break silently at the assertion level rather than at the import level.

## Notes

Coupled to DEBT-019 - once the controller uses callbacks, tests can assert on callback
invocations instead of action type strings.

## Fix Plan

Short term: import `setReplayIndex.type` etc. from the slice to get compile-time breakage.
Long term: resolve DEBT-019 first, then test via callbacks.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
