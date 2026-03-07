---
id: DEBT-004
title: Sprite atlas worker response not validated for request correlation
type: debt
severity: low
area: ui
regression: false
status: fixed
discovered_at: 2026-03-06
introduced_in: phase6
branch: main
pr: null
commit: null
owner: null
fixed_at: 2026-03-07
fixed_by: JSly
---

## Summary

At spriteAtlas.client.ts:165, :218 and GameCanvas.tsx:113, if a malformed or stale worker message
returns mismatched (cellSize, dpr), it can be cached under the request key yet later rejected by
render-key checks, causing silent fallback behavior.

## Expected

Worker responses should be correlated by request ID to prevent stale or mismatched responses from
being cached under the wrong key.

## Actual

Responses are validated for shape but not correlated to the originating request.

## Notes

Source: Review 3.

## Fix Plan

Add a request ID to worker messages and validate that responses match the originating request
before caching.

## Resolution

- `apps/web/app/canvas/spriteAtlas.types.ts` adds `requestId` to sprite-atlas request and worker
  response messages, and validates that it is present.
- `apps/web/app/canvas/spriteAtlas.client.ts` now correlates worker responses by `requestId` and
  rejects stale or mismatched atlas payloads before caching them.
- `apps/web/app/canvas/spriteAtlasWorker.client.ts` echoes the originating `requestId`, and the
  sprite-atlas tests cover both uncorrelated and mismatched-response cases.

## Verification

- [x] test added or updated
- [x] manual verification completed
- [-] docs updated if needed
