---
id: DEBT-009
title: Root theme is hardcoded to dark and ignores settings theme state
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

Docs still defer the theme-state mismatch, and the code confirms it remains unresolved. The root
document hardcodes `<html className="dark">` while the Redux settings slice defaults `theme` to
`light`, so the app does not actually source theme selection from the state model.

## Expected

The root document theme class should reflect the actual selected theme or a documented SSR-safe
bootstrap value derived from the same source of truth.

## Actual

`apps/web/app/root.tsx` forces dark mode at the document root, while
`apps/web/app/state/settingsSlice.ts` exposes a light/dark theme state that is not applied there.
This leaves the settings model disconnected and matches the documented SSR theme-flash follow-up.

## Repro

1. Inspect `apps/web/app/root.tsx`
2. Inspect `apps/web/app/state/settingsSlice.ts`
3. Observe that the document class is always `dark` even though the settings state defaults to
   `light`

## Notes

Documented as deferred in `docs/project-plan.md`. This is current UI debt, not a future roadmap
feature.

## Fix Plan

- Decide the actual theme source of truth for SSR and hydration
- Apply the resolved theme class at the document root
- Add verification for initial render and theme switching behavior

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
