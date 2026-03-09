# ADR 0027: Host-pluggable Remix server boundary

**Status:** Accepted
**Date:** 2026-03-09
**Deciders:** Corgiban maintainers

## Context

The product is already browser-first:

- gameplay runs in the browser
- solver and benchmark heavy work run in browser workers
- persistence is browser-side
- the host mainly serves the Remix app shell and route documents

That makes hosting a deployment concern, not a product-logic concern. If the server-rendering
boundary is coupled directly to a single host package, every future host would force route/root
refactors that do not change user behavior.

Before locking in a concrete deployment target, the app needs a server-rendering structure that:

- keeps shared document rendering reusable
- keeps route/root modules runtime-neutral
- keeps host-specific files isolated to thin adapters

## Decision

- Keep shared document rendering host-neutral in:
  - `apps/web/app/server/*`
  - `apps/web/app/entry.server.tsx`
- Treat host packages as adapter-only dependencies:
  - route/root/server-render code uses `@remix-run/server-runtime` and `@remix-run/react`
  - host packages such as `@remix-run/cloudflare-pages` stay in adapter files
- Keep host-specific wiring isolated to:
  - `apps/web/functions/*`
  - host config such as `apps/web/wrangler.jsonc`
  - `preview:<host>` / `deploy:<host>` scripts
- Standardize script naming so additional hosts can follow the same pattern later:
  - `preview:cloudflare`
  - `deploy:cloudflare`

## Consequences

**Positive:**

- Adding another Remix-compatible host (for example Vercel) no longer requires rewriting route or
  root modules.
- Shared server rendering stays reusable and testable as app infrastructure instead of host glue.
- The deployment target remains explicit without hiding host selection behind generic script names.

**Negative:**

- The repo now has one more architectural layer to explain: shared server rendering vs host adapter
  wiring.
- `entry.server.tsx` remains a framework/server boundary file even though it is now host-neutral.

## Alternatives considered

- Keep host-package imports in route/root files (rejected: unnecessary host coupling).
- Move all server-render behavior into each host adapter (rejected: duplicates app infrastructure
  and makes future hosts harder to add).
- Introduce a multi-host build switch immediately (rejected: premature until a second host is
  actually implemented).

## Links

- `apps/web/app/server/renderDocumentResponse.tsx`
- `apps/web/app/entry.server.tsx`
- `apps/web/package.json`
- `docs/adr/0028-cloudflare-pages-runtime-adapter.md`
