---
id: DEBT-006
title: Imported benchmark metadata comparison silently degrades without UI signal
type: debt
severity: low
area: bench
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

The parser schema intentionally allows partial comparable metadata. Records from external imports
may silently downgrade to degraded comparison behavior without any clear UI signal to the user.

## Expected

Users should be informed when imported records degrade comparison capability, either via a UI
warning or explicit documentation of the limitation.

## Actual

Degraded comparison happens silently. benchmarkSchema.ts:246, benchmarkTypes.ts:92.

## Notes

Source: Review 4 #5. May be acceptable for this phase but should be documented.

## Fix Plan

- Document as a known limitation in the bench UI or README
- Optionally surface a warning in the analytics panel when degraded records are detected

## Resolution

- `apps/web/app/state/benchThunks.ts` now inspects imported measured rows for missing comparable
  metadata and records a user-visible import notice listing the affected suites.
- `/bench` already renders `diagnostics.lastNotice` through `BenchDiagnosticsPanel`, so the new
  notice reaches the UI without adding another import-specific component path.
- Tests: `benchThunks.edgeCases.test.ts` covers the degraded-comparison notice, and the existing
  diagnostics rendering path surfaces the message in the route UI.

## Verification

- [x] test added or updated
- [x] manual verification completed
- [-] docs updated if needed
