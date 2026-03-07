# packages/benchmarks

Benchmark domain contracts and deterministic runner orchestration.

## Responsibilities

- Benchmark suite/run/result model types and comparable metadata
- IndexedDB schema ownership constants (`BENCHMARK_DB_*`, `DEFAULT_BENCHMARK_RETENTION_LIMIT`)
- Deterministic benchmark runner sequencing (warmup + measured repetitions)
- Versioned benchmark report parsing (`parseBenchmarkReportJson`) and strict run-record validation

Persistence adapters (IndexedDB, browser APIs) do not live in this package; they live in `apps/web`.

## Allowed imports

- `@corgiban/solver`
- `@corgiban/core`
- `@corgiban/shared`

No React, no DOM/Web APIs, no IndexedDB usage.

## Public API

Exports come from `src/index.ts`:

- Runtime/version:
  - `benchmarksVersion`
- Model types:
  - `BenchmarkAlgorithmConfig`
  - `BenchmarkSuite`
  - `BenchmarkRunExecutionRequest`
  - `BenchmarkRunOutcome`
  - `BenchmarkRunPlan`
  - `BenchmarkRunRecord`
  - `BenchmarkSuiteRunRequest`
  - `BenchmarkRunnerProgress`
  - `BenchmarkRunnerExecute`
  - `BenchmarkComparableMetadata`
  - `BenchmarkEnvironmentSnapshot`
  - `BenchmarkSolverOptionMetadata`
- Schema constants and guards:
  - `BENCHMARK_DB_NAME`
  - `BENCHMARK_DB_VERSION`
  - `BENCHMARK_DB_STORES`
  - `BENCHMARK_DB_INDEXES`
  - `BENCHMARK_DB_SCHEMA`
  - `BENCHMARK_REPORT_TYPE`
  - `BENCHMARK_REPORT_VERSION`
  - `BENCHMARK_REPORT_EXPORT_MODEL`
  - `DEFAULT_BENCHMARK_RETENTION_LIMIT`
  - `isBenchmarkRunRecord(...)`
  - `parseBenchmarkReportJson(...)`
- Report payload type:
  - `BenchmarkReportPayload`
- Comparison types:
  - `BenchmarkComparableRunInput`
  - `BenchmarkSuiteComparisonInfo`
- Comparison helpers:
  - `toComparableRunInput(...)`
  - `buildSuiteComparisonInfo(...)`
- Runner APIs:
  - `buildBenchmarkRunPlans(...)`
  - `buildComparableMetadata(...)`
  - `runBenchmarkSuite(...)`
- Runner types:
  - `BenchmarkRunnerOptions`
  - `BuildBenchmarkRunPlansRequest`
  - `CreateBenchmarkRunId`

Report contract baseline:

- `BENCHMARK_REPORT_TYPE = "corgiban-benchmark-report"`
- `BENCHMARK_REPORT_VERSION = 2`
- `BENCHMARK_REPORT_EXPORT_MODEL = "multi-suite-history"`
- report imports/exports are expected to validate each `results` entry with `isBenchmarkRunRecord(...)`
- `parseBenchmarkReportJson(...)` enforces size limits, supported version/model checks, and strict
  run-record validation with explicit errors
- App adapters may attach extra top-level metadata such as `exportedAtIso`; the parser keys off
  the required contract fields above and ignores extra top-level metadata.

Comparison contract baseline:

- `toComparableRunInput(...)` and `buildSuiteComparisonInfo(...)` derive exact suite-input
  fingerprints from measured run metadata.
- `buildSuiteComparisonInfo(...)` sorts inputs in a canonical locale-independent order
  (`levelId`, `repetition`, serialized tiebreaker) before fingerprinting so comparison exports stay
  stable across runtimes.
- Fingerprints include level/repetition inputs, solver options, environment metadata, and warm-up
  settings.
- Comparison helpers expect measured `BenchmarkRunRecord` data; warm-up runs are excluded before
  persistence/comparison in the app layer.
- Imported reports may legitimately omit `comparableMetadata`; consumers should surface a user-
  visible notice when that downgrades strict comparison availability.
- Consumers should treat fingerprint mismatches as non-comparable, not synthesize delta metrics.

Runner contract baseline:

- `runBenchmarkSuite(...)` clamps `finishedAtMs` to at least `startedAtMs` when a caller-supplied
  clock moves backward, so persisted durations never go negative.

## Usage example

```ts
import { runBenchmarkSuite } from '@corgiban/benchmarks';

const records = await runBenchmarkSuite(
  {
    suiteRunId: 'suite-1',
    suite: {
      levelIds: ['classic-001'],
      solverConfigs: [
        {
          algorithmId: 'bfsPush',
          options: { timeBudgetMs: 30_000, nodeBudget: 2_000_000 },
        },
      ],
      repetitions: 2,
      warmupRepetitions: 0,
      timeBudgetMs: 30_000,
      nodeBudget: 2_000_000,
    },
    environment: {
      userAgent: 'bench-runner',
      hardwareConcurrency: 8,
      appVersion: 'local',
    },
  },
  {
    execute: async (request) => solveLevel(request), // adapter-owned solver call
  },
);
```

## Testing

Run package tests only:

```bash
pnpm exec vitest run --config packages/benchmarks/vitest.config.ts
```
