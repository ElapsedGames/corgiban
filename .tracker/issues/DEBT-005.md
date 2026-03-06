---
id: DEBT-005
title: Lab payload schema not strict-closed on unknown keys
type: debt
severity: low
area: lab
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

Unlike the benchmark report and level-pack parsers, labPayload.ts validates only required fields.
If strict schema enforcement is intended for this versioned payload, unknown-key rejection is
missing.

## Expected

Lab payload schema uses strict/passthrough to reject or explicitly allow unknown keys, consistent
with other versioned parsers in the project.

## Actual

labPayload.ts:6 validates only required fields; unknown keys are silently accepted.

## Notes

Source: Review 3.

## Fix Plan

Add .strict() or equivalent to the labPayload Zod schema if strict enforcement is intended.
If passthrough is intentional, document why.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
