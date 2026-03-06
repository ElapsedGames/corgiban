---
id: DEBT-006
title: Imported benchmark metadata comparison silently degrades without UI signal
type: debt
severity: low
area: bench
regression: false
status: open
discovered_at: 2026-03-06
introduced_in: phase6
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
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

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
