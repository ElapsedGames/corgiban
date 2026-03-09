# ADR 0026: App-shell theme ownership

**Status:** Accepted
**Date:** 2026-03-09
**Deciders:** Corgiban maintainers

## Context

The app now needs a persistent root-level navigation bar that appears above every route and offers a
light/dark theme toggle. The previous theme contract kept `theme` inside the route-scoped Redux
stores for `/play` and `/bench`, then synced `settings.theme` to `document.documentElement` after
commit.

That design no longer fits a root-owned toggle cleanly:

- `root.tsx` does not sit inside a global Redux provider
- `/lab`, `/`, and error surfaces should also share the same app-shell theme
- keeping both route Redux state and root UI state would create split theme ownership
- hard reloads need a pre-paint theme decision to avoid a light flash when dark is preferred

## Decision

- The app shell owns light/dark theme state in `apps/web/app/root.tsx`.
- The root app shell resolves the initial `<html>` theme before paint using:
  - persisted browser preference when available
  - `prefers-color-scheme` fallback on first visit
- The root navigation toggle updates `document.documentElement` and persists the explicit user
  choice for later visits.
- Route-scoped Redux stores no longer own or sync theme state.
- `settingsSlice` keeps gameplay and solver settings only; theme is removed from that slice.
- The browser-storage read/write used for pre-paint theme bootstrap is a narrow exception to the
  normal app persistence layering because this decision must happen before route stores mount.

## Consequences

**Positive:**

- Theme ownership becomes single-sourced and available across every route and root error surface.
- Hard reloads can respect dark preference without a light flash.
- Route modules no longer need duplicate theme-sync hooks.

**Negative:**

- Theme state is no longer visible in Redux devtools/history.
- Theme persistence now lives in the app shell instead of the route store contract.
- Future theme settings beyond light/dark must extend the root app-shell contract, not Redux by
  default.

## Alternatives considered

- Keep `theme` in route-scoped Redux and add a second root context (rejected: conflicting owners).
- Introduce a new global Redux store at the root solely for theme (rejected: unnecessary app-wide
  store expansion).
- Leave theme route-local and add no root toggle (rejected: does not satisfy the app-shell UX).

## Rollout plan (if applicable)

- Add a root `AppNav` component in `apps/web/app/ui/AppNav.tsx`.
- Add app-shell theme helpers/hooks under `apps/web/app/theme/`.
- Remove `useThemeSync` and `settings.theme`.
- Update docs that previously described route-scoped theme ownership.

## Testing plan

- Unit tests for theme resolution, persistence, and DOM class application.
- Hook tests for root theme adoption and toggle persistence.
- Component tests for root navigation links and active-state styling.

## Links

- `apps/web/app/root.tsx`
- `apps/web/app/ui/AppNav.tsx`
- `apps/web/app/theme/theme.ts`
- `apps/web/app/theme/useAppTheme.ts`
- `docs/Architecture.md`
- `apps/web/README.md`
- `LLM_GUIDE.md`
