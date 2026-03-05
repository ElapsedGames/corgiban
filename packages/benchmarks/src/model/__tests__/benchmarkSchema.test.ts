import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_DB_INDEXES,
  BENCHMARK_DB_NAME,
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
  BENCHMARK_DB_SCHEMA,
  BENCHMARK_DB_STORES,
  BENCHMARK_DB_VERSION,
  DEFAULT_BENCHMARK_RETENTION_LIMIT,
  isBenchmarkRunRecord,
} from '../benchmarkSchema';

function createValidRecord() {
  return {
    id: 'suite-1:1',
    suiteRunId: 'suite-1',
    runId: 'suite-1:exec-1',
    sequence: 1,
    levelId: 'classic-001',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1000,
      nodeBudget: 500,
    },
    status: 'unsolved',
    metrics: {
      elapsedMs: 12,
      expanded: 34,
      generated: 56,
      maxDepth: 3,
      maxFrontier: 4,
      pushCount: 1,
      moveCount: 2,
    },
    startedAtMs: 100,
    finishedAtMs: 120,
    environment: {
      userAgent: 'vitest',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
  };
}

function createValidComparableMetadata() {
  return {
    solver: {
      algorithmId: 'bfsPush',
      heuristicId: 'manhattan',
      heuristicWeight: 1,
      timeBudgetMs: 1000,
      nodeBudget: 500,
      enableSpectatorStream: true,
    },
    environment: {
      userAgent: 'vitest',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    warmupEnabled: true,
    warmupRepetitions: 1,
  };
}

describe('benchmarkSchema', () => {
  it('defines stable IndexedDB ownership constants', () => {
    expect(BENCHMARK_DB_NAME).toBe('corgiban-benchmark');
    expect(BENCHMARK_DB_VERSION).toBe(2);
    expect(BENCHMARK_DB_STORES.runs).toBe('benchmarkResults');
    expect(BENCHMARK_DB_INDEXES.runsBySuiteRunId).toBe('bySuiteRunId');
    expect(BENCHMARK_DB_INDEXES.runsByFinishedAtMs).toBe('byFinishedAtMs');
    expect(BENCHMARK_DB_SCHEMA.version).toBe(BENCHMARK_DB_VERSION);
    expect(DEFAULT_BENCHMARK_RETENTION_LIMIT).toBe(100);
    expect(BENCHMARK_REPORT_TYPE).toBe('corgiban-benchmark-report');
    expect(BENCHMARK_REPORT_VERSION).toBe(2);
    expect(BENCHMARK_REPORT_EXPORT_MODEL).toBe('multi-suite-history');
  });

  it('accepts valid benchmark run records', () => {
    expect(isBenchmarkRunRecord(createValidRecord())).toBe(true);
  });

  it('rejects invalid benchmark run records', () => {
    const invalidRecord = {
      ...createValidRecord(),
      metrics: {
        elapsedMs: 'invalid',
      },
    };

    expect(isBenchmarkRunRecord(invalidRecord)).toBe(false);
  });

  it('rejects records when required options are missing or malformed', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: undefined,
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          timeBudgetMs: 0,
        },
      }),
    ).toBe(false);
  });

  it('rejects records with invalid enum-like fields', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        algorithmId: 'unsupported-algorithm',
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        status: 'maybe',
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          heuristicId: 'invalid-heuristic',
        },
      }),
    ).toBe(false);
  });

  it('rejects values that are not object records', () => {
    expect(isBenchmarkRunRecord(null)).toBe(false);
    expect(isBenchmarkRunRecord('record')).toBe(false);
    expect(isBenchmarkRunRecord(123)).toBe(false);
  });

  it('rejects records with invalid metrics/environment shapes', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        metrics: null,
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        environment: null,
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        metrics: {
          ...createValidRecord().metrics,
          elapsedMs: Number.NaN,
        },
      }),
    ).toBe(false);
  });

  it('rejects records containing unknown fields', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        unexpectedField: true,
      }),
    ).toBe(false);
  });

  it('accepts records with valid optional fields', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        warmup: false,
        solutionMoves: 'R',
        errorDetails: 'none',
        comparableMetadata: createValidComparableMetadata(),
      }),
    ).toBe(true);
  });

  it('accepts options with heuristic weight at configured bounds', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          heuristicId: 'manhattan',
          heuristicWeight: 1,
        },
      }),
    ).toBe(true);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          heuristicId: 'assignment',
          heuristicWeight: 10,
        },
      }),
    ).toBe(true);
  });

  it('rejects solver options with unknown keys', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          timeBudgetMs: 1000,
          nodeBudget: 500,
          unexpected: true,
        },
      }),
    ).toBe(false);
  });

  it('rejects heuristic weights outside configured bounds', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          heuristicId: 'manhattan',
          heuristicWeight: 0.99,
        },
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          heuristicId: 'manhattan',
          heuristicWeight: 10.01,
        },
      }),
    ).toBe(false);
  });

  it('rejects invalid option field types', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        options: {
          timeBudgetMs: 1000,
          nodeBudget: 500,
          enableSpectatorStream: 'yes',
        },
      }),
    ).toBe(false);
  });

  it('rejects error status when errorMessage is missing', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        status: 'error',
      }),
    ).toBe(false);
  });

  it('accepts error status when errorMessage is present', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        status: 'error',
        errorMessage: 'worker crashed',
      }),
    ).toBe(true);
  });

  it('rejects records where finishedAtMs is before startedAtMs', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        startedAtMs: 121,
        finishedAtMs: 120,
      }),
    ).toBe(false);
  });

  it('rejects non-integer sequence values', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        sequence: 1.5,
      }),
    ).toBe(false);
  });

  it('rejects non-positive repetition values', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        repetition: 0,
      }),
    ).toBe(false);
  });

  it('rejects non-boolean warmup values', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        warmup: 'true',
      }),
    ).toBe(false);
  });

  it('rejects non-string optional text fields', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        solutionMoves: 123,
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        errorDetails: { reason: 'bad' },
      }),
    ).toBe(false);
  });

  it('rejects invalid comparable metadata structures', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        comparableMetadata: {
          ...createValidComparableMetadata(),
          warmupRepetitions: -1,
        },
      }),
    ).toBe(false);

    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        comparableMetadata: {
          ...createValidComparableMetadata(),
          extraField: true,
        },
      }),
    ).toBe(false);
  });

  it('rejects comparable metadata with invalid solver metadata', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        comparableMetadata: {
          ...createValidComparableMetadata(),
          solver: {
            ...createValidComparableMetadata().solver,
            algorithmId: 'unknown',
          },
        },
      }),
    ).toBe(false);
  });

  it('rejects comparable metadata solver nodeBudget when not positive', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        comparableMetadata: {
          ...createValidComparableMetadata(),
          solver: {
            ...createValidComparableMetadata().solver,
            nodeBudget: 0,
          },
        },
      }),
    ).toBe(false);
  });

  it('rejects comparable metadata solver enableSpectatorStream when not boolean', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        comparableMetadata: {
          ...createValidComparableMetadata(),
          solver: {
            ...createValidComparableMetadata().solver,
            enableSpectatorStream: 'true',
          },
        },
      }),
    ).toBe(false);
  });

  it('rejects comparable metadata with invalid environment metadata', () => {
    expect(
      isBenchmarkRunRecord({
        ...createValidRecord(),
        comparableMetadata: {
          ...createValidComparableMetadata(),
          environment: {
            ...createValidComparableMetadata().environment,
            extraField: true,
          },
        },
      }),
    ).toBe(false);
  });

  it('accepts records created with a null prototype', () => {
    const record = Object.assign(Object.create(null), createValidRecord());

    expect(isBenchmarkRunRecord(record)).toBe(true);
  });
});
