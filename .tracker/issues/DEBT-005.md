---
id: DEBT-005
title: Lab payload schema not strict-closed on unknown keys
type: debt
severity: low
area: lab
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

Made the /lab payload contract strict-closed on top-level keys, added shared create/parse helpers for the versioned payload, and covered unknown-key rejection in unit and page tests.

## Verification

- [x] test added or updated
- [x] manual verification completed
- [x] docs updated if needed
