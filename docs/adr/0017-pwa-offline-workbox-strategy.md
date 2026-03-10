# ADR 0017: PWA offline shell strategy (Workbox + dev registration toggle)

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

Phase 5 requires offline shell support after first successful load while keeping local development
predictable. Always-on service workers in dev can mask route/data changes and create cache-debugging
noise unless registration is explicit. The app also needs deterministic smoke coverage for offline
behavior in CI and local validation.

## Decision

- `apps/web` uses `vite-plugin-pwa` for manifest and service worker generation.
- Worker registration is app-owned in `entry.client.tsx` and enabled when:
  - `import.meta.env.PROD` is true, or
  - `VITE_ENABLE_PWA_DEV=1` is set for explicit dev/manual validation.
- Workbox runtime caching handles navigation requests with `NetworkFirst` and a bounded cache.
- Browsers/environments without service worker support continue in network-only mode.
- Playwright smoke runs against a production build + preview server and fails when service worker
  readiness or PWA assets are unavailable.

## Consequences

**Positive:**

- Offline shell behavior is available in production with a single build-time integration path.
- Dev ergonomics stay stable by default because service worker registration is opt-in outside
  production.
- Smoke validation can exercise offline behavior deterministically through explicit env config.

**Negative:**

- Adds `vite-plugin-pwa`/Workbox configuration surface that must be maintained with route behavior.
- Navigation caching policy choices (for example timeout/cache limits) require periodic tuning.
- Offline smoke requires environments that support service workers in automated browsers.

## Alternatives considered

- Hand-rolled service worker without `vite-plugin-pwa` (rejected: more custom maintenance).
- Cache-first navigation strategy (rejected: weaker freshness for route navigations).
- Always register service worker in dev (rejected: higher cache/staleness risk during iteration).

## Rollout plan (if applicable)

- Add PWA plugin config in `apps/web/vite.config.ts`.
- Register service worker in `apps/web/app/entry.client.tsx` using production-or-env-gated logic.
- Keep offline verification in smoke coverage on the production build path.

## Testing plan

- Playwright smoke test validates `/play` offline shell availability after first load.
- Playwright smoke asserts `manifest.webmanifest` and `/sw.js` are served by the production build.
- Manifest coverage keeps the generated play-first entry contract explicit (`start_url: '/play'`,
  `scope: '/'`) instead of relying only on asset existence checks.
- Build verification confirms manifest/service worker assets are produced.
- Regression checks confirm app still works when service workers are unavailable.

## Links

- `docs/Architecture.md` (sections 3.15, 16.1)
- `docs/project-plan.md` (Phase 5, Task 4)
- `apps/web/vite.config.ts`
- `apps/web/app/entry.client.tsx`
