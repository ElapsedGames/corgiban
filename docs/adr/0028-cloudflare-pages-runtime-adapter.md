# ADR 0028: Cloudflare Pages runtime adapter

**Status:** Accepted
**Date:** 2026-03-09
**Deciders:** Corgiban maintainers

## Context

ADR-0027 defines the host-pluggable server boundary for the Remix app. With that boundary in
place, the project still needs a concrete deployment target that works cleanly with the existing
Cloudflare-managed DNS and custom-domain plan for `corgiban.elapsedgames.com`.

The repo had been wired around a Node-oriented Remix preview/runtime contract
(`@remix-run/node`, `remix-serve`, and a Node stream server entry). The current deployment target
should align with the team's Cloudflare setup while preserving the host-neutral structure defined
in ADR-0027.

## Decision

- Standardize the current deployment target on Cloudflare Pages.
- Keep Cloudflare-specific code isolated to the deployment adapter layer:
  - `apps/web/functions/[[path]].ts`
  - `apps/web/wrangler.jsonc`
  - Cloudflare preview/deploy scripts
- Reuse the shared host-neutral server render path instead of moving server rendering into the
  Cloudflare adapter.
- Use `wrangler pages dev` for local production-style preview and `wrangler pages deploy` for the
  Cloudflare deployment path.

## Consequences

**Positive:**

- Deployment aligns with the existing Cloudflare DNS/custom-domain setup.
- The app can be previewed locally in a Cloudflare-like runtime path before deployment.
- Browser-heavy product logic remains portable and separate from hosting concerns.

**Negative:**

- The deployment adapter adds Cloudflare-specific config/files to `apps/web`.
- The current production-style preview path is Cloudflare-oriented rather than `remix-serve`.
- Future non-Cloudflare hosts will still need their own thin adapter layer.

## Alternatives considered

- Keep the Node-oriented preview/runtime and deploy elsewhere (rejected: does not align with the
  stated goal of consolidating on Cloudflare).
- Convert the app to static-only hosting (rejected: unnecessary given Remix SSR/document delivery
  and the existing route/status semantics).
- Let Cloudflare-specific APIs leak into routes/loaders directly (rejected: would make the app
  harder to port and harder to reason about).

## Rollout plan

- Add the Pages function catch-all and Wrangler config.
- Replace the Node-specific preview/runtime path with the Cloudflare adapter path.
- Update preview/deploy scripts and smoke validation to run through the Cloudflare adapter path.
- Update architecture and package docs to make the hosting boundary explicit.

## Testing plan

- Keep existing route and smoke tests passing through `pnpm test:smoke`.
- Keep `pnpm typecheck`, `pnpm lint`, and `pnpm test:coverage` green after the runtime shift.
- Use the Cloudflare-backed preview path in smoke tests to validate the deployment adapter itself.

## Links

- `apps/web/functions/[[path]].ts`
- `apps/web/scripts/preview-cloudflare.mjs`
- `apps/web/wrangler.jsonc`
- `apps/web/app/server/renderDocumentResponse.tsx`
- `apps/web/app/entry.server.tsx`
- `docs/adr/0027-host-pluggable-remix-server-boundary.md`
- `docs/Architecture.md`
- `apps/web/README.md`
- `LLM_GUIDE.md`
