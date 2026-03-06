---
id: DEBT-003
title: Comparison fingerprint sort is locale-sensitive
type: debt
severity: low
area: data
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

localeCompare at comparison.ts:44 can vary by runtime locale or collation settings. For a strict
fingerprint contract, byte-wise canonical ordering should be used instead.

## Expected

Fingerprint sort uses byte-wise ordering for deterministic, locale-independent results.

## Actual

localeCompare is used, which can vary by locale.

## Notes

Source: Review 3. Low risk in practice since most fingerprint keys are ASCII.

## Fix Plan

Replace localeCompare with a byte-wise sort (e.g. a < b ? -1 : a > b ? 1 : 0) in comparison.ts.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
