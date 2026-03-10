# ADR 0029: Play-first root entrypoint and specialist route charters

**Status:** Accepted
**Date:** 2026-03-10
**Deciders:** Corgiban maintainers

## Context

Phase 7 is clarifying route ownership across `/play`, `/lab`, and `/bench`.

The previous root route rendered a landing page that duplicated the same entry links already
present in the shared app navigation. That added an extra click before reaching the primary
gameplay surface and blurred the distinction between:

- `/play` as the default product entry
- `/lab` as the authoring/debugging surface
- `/bench` as the suite/analytics surface
- `/dev/ui-kit` as an internal validation route

The route-responsibility pass needs one durable contract for the app shell, smoke tests, and
future cross-route handoff flows.

## Decision

- `/play` is the primary product entrypoint.
- `/` redirects to `/play` instead of rendering a standalone landing page.
- The shared brand link in `AppNav` navigates to `/play`.
- Primary navigation exposes `/play`, `/bench`, and `/lab`.
- `/dev/ui-kit` remains a direct-access validation route and is not part of the primary workflow
  nav.
- Future cross-route handoff flows must preserve these route charters unless a later ADR changes
  them.

## Consequences

- Positive: first-load navigation reaches gameplay in one step.
- Positive: route ownership is clearer for docs, smoke tests, and future handoff flows.
- Positive: the shared app shell can prioritize product workflows over duplicated overview content.
- Negative: the root route no longer carries standalone overview/marketing copy inside the app.
- Negative: `/dev/ui-kit` is intentionally less discoverable for non-developer users.

## Alternatives considered

- Keep the root landing page and shared navigation in parallel.
- Keep the brand link on `/` while letting users navigate onward manually.
- Expose `/dev/ui-kit` in the primary navigation beside product workflows.

## Rollout plan (if applicable)

- Update the root Remix route loader to redirect `/` to `/play`.
- Update shared navigation and smoke tests to treat `/play` as the canonical entry surface.
- Update architecture, project-plan, README, and app README docs to reflect the route contract.

## Testing plan

- Route unit tests cover the `/` redirect loader behavior.
- E2E smoke tests verify `/` lands on `/play`.
- Navigation tests verify the shared brand link returns to `/play`.

## Links

- `docs/Architecture.md`
- `docs/project-plan.md` (Phase 7)
- `apps/web/README.md`
- `apps/web/app/routes/_index.tsx`
- `__tests__/e2e/routes.spec.ts`
