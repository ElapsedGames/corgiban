# ADR 0020: Benchmark comparison snapshot contract and strict suite-input comparability

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

Phase 6 adds `/bench` analytics, baseline selection, and exportable comparison snapshots. Persisted
benchmark history can include different:

- solver options and algorithm choices
- warm-up settings
- runtime environments (`userAgent`, hardware concurrency, app version)
- level/repetition input sets

Computing deltas across mismatched suites would produce misleading "faster/slower" conclusions.
We need an explicit comparison contract so exported artifacts and in-app analytics stay
reviewable, deterministic, and forward-versionable.

## Decision

- Comparison snapshot export is a typed/versioned artifact:
  - `type: "corgiban-benchmark-comparison"`
  - `version: 2`
  - `comparisonModel: "strict-suite-input-fingerprint"`
- Measured benchmark records capture explicit comparable metadata:
  - solver options
  - environment snapshot
  - warm-up enablement and repetition count
- Suite comparability is derived from a sorted fingerprint of measured run inputs:
  - `levelId`
  - `repetition`
  - solver comparable metadata
  - environment metadata
  - warm-up metadata
- `/bench` computes deltas only when a suite fingerprint matches the selected baseline exactly.
- Non-comparable suites remain visible in analytics and exports, but carry an explicit reason and
  `null` delta values instead of synthetic comparisons.

## Consequences

**Positive:**

- Comparisons stay apples-to-apples and defensible.
- Exported comparison snapshots are explicit public artifacts instead of ad-hoc UI state dumps.
- Future comparison modes can be added with a new `comparisonModel` and/or version bump.

**Negative:**

- Suites that differ only slightly (for example environment or warm-up settings) are intentionally
  non-comparable under the baseline model.
- Additional metadata must be stored on measured benchmark records to support comparison.
- Evolving the snapshot contract requires coordinated doc/test updates.

## Alternatives considered

- Compare suites by `suiteRunId` only without validating inputs.
- Ignore environment or warm-up differences when computing deltas.
- Keep comparison as in-memory UI state only with no exported artifact contract.

## Rollout plan (if applicable)

- Capture comparable metadata on measured benchmark records.
- Derive suite fingerprints in shared comparison helpers.
- Export `/bench` comparison snapshots only when the selected baseline is comparable.
- Treat future relaxed or alternative comparison modes as additive contract changes, not silent
  behavior edits to the baseline model.

## Testing plan

- Unit tests for comparable-input extraction and suite fingerprint generation.
- UI tests for baseline selection, non-comparable suite reasons, and snapshot-export enablement.
- Regression tests ensuring warm-up metadata and environment metadata affect comparability.

## Links

- `docs/Architecture.md` (sections 3.18 and 9.4)
- `docs/project-plan.md` (Phase 6 task 8)
- `packages/benchmarks/README.md`
- `apps/web/README.md`
