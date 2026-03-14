---
id: DEBT-013
title: Proper SSR theme state should come from the server instead of client-only hydration
type: debt
severity: low
area: ui
regression: false
status: deferred
discovered_at: 2026-03-13
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

The nav theme toggle currently avoids hydration warnings with a client-side guard, but the real
theme state is still resolved only after mount. The correct long-term fix is to source the initial
theme from the server so SSR and hydration agree without relying on client-only readiness gating.

## Expected

The server-rendered document and the client hydration render should agree on the theme toggle state
and the active theme immediately, ideally from a cookie- or loader-backed theme source.

## Actual

The current minimal fix in `apps/web/app/ui/AppNav.tsx` removes the `disabled` attribute mismatch
by keeping the button enabled in markup and ignoring clicks until theme hydration completes.
That stops the React warning, but the app still depends on client-only theme readiness from
`apps/web/app/theme/useAppTheme.ts`.

## Repro

1. Load the app with dev hydration warnings enabled.
2. Observe that the previous `disabled` attribute mismatch no longer appears.
3. Inspect the theme flow and note that the initial theme still comes from client-side document
   state after mount rather than a server-provided value.

## Notes

- Minimal mitigation shipped in:
  - `apps/web/app/ui/AppNav.tsx`
- Client-only theme readiness still lives in:
  - `apps/web/app/theme/useAppTheme.ts`
- Root theme bootstrap remains inline-script based in:
  - `apps/web/app/root.tsx`

## Fix Plan

- Add a server-readable theme source, likely cookie-backed.
- Feed that theme into the root document so SSR and hydration render the same nav state.
- Remove the client-only readiness workaround once SSR theme ownership is in place.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
