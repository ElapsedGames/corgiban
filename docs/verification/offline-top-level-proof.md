# Offline Top-Level Navigation Proof

This document captures manual proof steps for top-level offline navigation when an automated harness reports `ERR_INTERNET_DISCONNECTED` before service-worker interception.

## Preconditions

1. Build and preview the production app: `pnpm test:smoke` (or `pnpm build` then `pnpm -C apps/web preview`).
2. Open `/play` while online and wait for service worker readiness.
3. Confirm service worker registration in DevTools Application tab.

## Manual proof steps

1. Load `/play` and verify the page heading and solver controls are visible.
2. Disable network in browser DevTools (`Offline` profile).
3. Perform a top-level reload (`Ctrl+R` / `Cmd+R`) on `/play`.
4. Verify `/play` renders app-shell content (`Corgiban` heading and `Run solve` button).
5. Execute a lightweight interaction (for example apply one move) to confirm shell interactivity.

## Expected result

- `/play` continues loading after top-level offline reload once service worker is active.
- Solver UI shell remains available and interactive without network.

## Automation note

`__tests__/e2e/offline.spec.ts` first attempts a top-level offline navigation assertion. If the harness blocks top-level SW interception, it falls back to same-origin iframe navigation proof and this manual checklist remains the source of truth for top-level behavior verification.
