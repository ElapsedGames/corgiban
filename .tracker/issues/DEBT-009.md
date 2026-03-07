---
id: DEBT-009
title: Root theme is hardcoded to dark and ignores settings theme state
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
owner: JSly
fixed_at: 2026-03-06
fixed_by: JSly
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

- `apps/web/app/root.tsx`: changed `className="dark"` to `className="light"` so the
  SSR-rendered HTML class matches the `settingsSlice` default of `'light'`.
- `apps/web/app/useThemeSync.ts`: new hook that reads `settings.theme` from the Redux
  store via `useSelector` and applies it to `document.documentElement.classList` in a
  `useEffect`, removing the opposing class on each theme change.
- `apps/web/app/routes/play.tsx`: added `PlayRouteInner` wrapper (inside `<Provider>`)
  that calls `useThemeSync()` so theme propagates on the /play route.
- `apps/web/app/routes/bench.tsx`: called `useThemeSync()` at the top of
  `BenchRoutePage` (already inside `<Provider>`) so theme propagates on /bench.
- `apps/web/app/__tests__/useThemeSync.test.tsx`: five tests covering initial mount,
  dark initial state, light-to-dark switch, dark-to-light switch, and no simultaneous
  dual-class state.

## Verification

- [x] test added or updated
- [x] manual verification completed
- [x] docs updated if needed
