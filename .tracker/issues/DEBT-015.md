---
id: DEBT-015
title: Play route still lacks a durable URL-fed custom puzzle import contract
type: debt
severity: medium
area: web
regression: false
status: deferred
discovered_at: 2026-03-15
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

`/play` supports built-in `levelId` links and session-scoped `levelRef` handoffs, but it still
lacks a durable public URL contract for loading custom puzzle data directly from a link.

## Expected

There should be an explicit, documented way to open a custom puzzle from a shareable URL without
depending on a prior browser session. That contract could be:

- URL-encoded level data
- a versioned URL payload
- or a server-backed saved puzzle id

## Actual

Custom/authored levels currently flow through `/lab` and browser-session playable entries. Exact
custom links depend on session-scoped `temp:*` refs and fail closed when the session data is not
present. Only canonical built-in `levelId` links are durably shareable today.

## Repro

1. Load a custom level through `/lab` and open it in `/play`.
2. Copy the resulting exact handoff URL using `levelRef=temp:...`.
3. Open that link in a fresh browser session.
4. Observe that `/play` renders an unavailable state because the session-backed playable entry is
   missing.

## Notes

- Current implementation references:
  - `apps/web/app/routes/play.tsx`
  - `apps/web/app/play/PlayPage.tsx`
  - `apps/web/app/navigation/handoffLinks.ts`
  - `apps/web/app/levels/temporaryLevelCatalog.ts`
- Current docs references:
  - `apps/web/README.md`
  - `docs/Architecture.md`
  - `docs/project-plan.md`

## Fix Plan

- Choose and document a durable custom-puzzle URL contract for `/play`.
- Validate and normalize URL-fed payloads through the same level parsing/import path as `/lab`.
- Keep malformed or unsupported URL payloads fail-closed with explicit user-facing errors.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
