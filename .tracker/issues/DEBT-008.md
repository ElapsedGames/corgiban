---
id: DEBT-008
title: UI primitives still have documented accessibility gaps before wider reuse
type: debt
severity: medium
area: ui
regression: false
status: open
discovered_at: 2026-03-06
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

Project docs still defer several accessibility gaps in shared UI primitives, and the current
implementations confirm those gaps remain: `Dialog` has no focus trap, `Tabs` has no arrow-key
navigation, and `Tooltip` overwrites `aria-describedby` instead of merging with existing values.

## Expected

Shared primitives should satisfy their baseline keyboard and ARIA contracts before they are reused
outside `/dev/ui-kit`.

## Actual

The accessibility gaps documented as deferred are still present in `apps/web/app/ui`, so the repo
is carrying known primitive-level a11y debt.

## Repro

1. Inspect `apps/web/app/ui/Dialog.tsx`, `Tabs.tsx`, and `Tooltip.tsx`
2. Note the lack of focus-trap logic in `Dialog`
3. Note the click-only tab switching in `Tabs`
4. Note the direct `aria-describedby` overwrite in `Tooltip`

## Notes

Documented in `docs/project-plan.md` as deferred while the primitives are limited to `/dev/ui-kit`.
This is debt, not a phase-gated future feature.

## Fix Plan

- Add focus management and trap behavior to `Dialog`
- Implement roving focus or arrow-key navigation in `Tabs`
- Merge `aria-describedby` in `Tooltip` instead of replacing existing descriptors

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
