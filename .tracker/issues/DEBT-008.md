---
id: DEBT-008
title: UI primitives still have documented accessibility gaps before wider reuse
type: debt
severity: medium
area: ui
regression: false
status: fixed
discovered_at: 2026-03-06
introduced_in: null
branch: main
pr: null
commit: null
owner: null
fixed_at: 2026-03-07
fixed_by: JSly
---

## Summary

Project docs still defer a remaining accessibility gap in shared UI primitives before wider reuse:
`Dialog` moves focus on open and handles Escape, but it still does not trap Tab and Shift+Tab
navigation within the modal.

## Expected

Shared primitives should satisfy their baseline keyboard and ARIA contracts before they are reused
outside `/dev/ui-kit`.

## Actual

Tabs now support arrow-key navigation and Tooltip now merges `aria-describedby`, but `Dialog`
still allows keyboard focus to escape the modal because a full focus trap has not landed yet.

## Repro

1. Open a dialog with multiple focusable elements
2. Press Tab or Shift+Tab repeatedly
3. Observe that focus can move outside the modal instead of cycling within it

## Notes

Documented in `docs/project-plan.md` as deferred while the primitives are limited to `/dev/ui-kit`.
This is debt, not a phase-gated future feature.

## Fix Plan

- Add Tab and Shift+Tab trapping to `Dialog`
- Extend dialog tests to cover focus cycling across the modal boundary

## Resolution

Dialog now traps Tab and Shift+Tab within the modal, keeps focus on the dialog container when no focusable descendants remain, and has jsdom coverage for open focus, wraparound, and Escape handling.

## Verification

- [x] test added or updated
- [x] manual verification completed
- [-] docs updated if needed
