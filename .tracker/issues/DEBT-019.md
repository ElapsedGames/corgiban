---
id: DEBT-019
title: ReplayController dispatches Redux slice actions directly instead of through ports
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

`ReplayController` (`apps/web/app/replay/replayController.client.ts`) imports
`setReplayIndex`, `setReplayState`, and `setReplayTotalSteps` directly from `solverSlice` and
dispatches them via the injected `dispatch` function. This couples the controller to Redux
action shapes.

## Expected

The controller should use injected callbacks or ports (consistent with the adapter/port
pattern used elsewhere) so it remains framework-agnostic and testable without Redux.

## Actual

Direct imports from `../state/solverSlice` and direct dispatch calls throughout the class.

## Notes

The controller already uses an `onStateChange` callback for game state updates, so the
pattern for decoupling exists - it just wasn't applied to the replay UI state dispatches.

## Fix Plan

Replace the `dispatch` + direct slice action imports with callback props like
`onReplayStateChange`, `onReplayIndexChange`, `onReplayTotalStepsChange`. Have the caller
wire those to Redux dispatch.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
