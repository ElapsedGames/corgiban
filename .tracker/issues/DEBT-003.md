---
id: DEBT-003
title: Comparison fingerprint sort is locale-sensitive
type: debt
severity: low
area: data
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

- `packages/benchmarks/src/model/comparison.ts`: replaced `localeCompare` with a
  three-level explicit comparator - ordinal `levelId` (byte-order, locale-independent),
  numeric `repetition`, then ordinal full-JSON tiebreaker. Added `compareOrdinal` helper
  and JSDoc documenting the ordering contract.
- `packages/benchmarks/src/model/__tests__/comparison.test.ts`: four new tests -
  ordinal levelId sort, numeric repetition sort (verifies 10 > 2), JSON tiebreaker
  determinism, and primary-key ordering (levelId beats repetition).

## Verification

- [x] test added or updated
- [x] manual verification completed
- [-] docs updated if needed
