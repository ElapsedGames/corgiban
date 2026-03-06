import { describe, expect, it } from 'vitest';

import { buildSuiteComparisonInfo, toComparableRunInput } from '../comparison';
import type { BenchmarkRunRecord } from '../benchmarkTypes';

function createRecord(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  const algorithmId = overrides.algorithmId ?? 'bfsPush';
  const options = overrides.options ?? {
    timeBudgetMs: 1_000,
    nodeBudget: 5_000,
  };
  const environment = overrides.environment ?? {
    userAgent: 'test-agent',
    hardwareConcurrency: 8,
    appVersion: 'test-build',
  };

  return {
    id: overrides.id ?? 'record-1',
    suiteRunId: overrides.suiteRunId ?? 'suite-1',
    runId: overrides.runId ?? 'run-1',
    sequence: overrides.sequence ?? 1,
    levelId: overrides.levelId ?? 'classic-001',
    algorithmId,
    repetition: overrides.repetition ?? 1,
    warmup: overrides.warmup ?? false,
    options,
    status: overrides.status ?? 'solved',
    metrics: overrides.metrics ?? {
      elapsedMs: 15,
      expanded: 10,
      generated: 12,
      maxDepth: 4,
      maxFrontier: 6,
      pushCount: 2,
      moveCount: 4,
    },
    startedAtMs: overrides.startedAtMs ?? 10,
    finishedAtMs: overrides.finishedAtMs ?? 25,
    solutionMoves: overrides.solutionMoves,
    errorMessage: overrides.errorMessage,
    errorDetails: overrides.errorDetails,
    environment,
    comparableMetadata: Object.prototype.hasOwnProperty.call(overrides, 'comparableMetadata')
      ? overrides.comparableMetadata
      : {
          solver: {
            algorithmId,
            ...(options.timeBudgetMs !== undefined ? { timeBudgetMs: options.timeBudgetMs } : {}),
            ...(options.nodeBudget !== undefined ? { nodeBudget: options.nodeBudget } : {}),
            ...(options.heuristicId !== undefined ? { heuristicId: options.heuristicId } : {}),
            ...(options.heuristicWeight !== undefined
              ? { heuristicWeight: options.heuristicWeight }
              : {}),
            ...(options.enableSpectatorStream !== undefined
              ? { enableSpectatorStream: options.enableSpectatorStream }
              : {}),
          },
          environment,
          warmupEnabled: false,
          warmupRepetitions: 0,
        },
  };
}

describe('benchmark comparison helpers', () => {
  it('maps run records to comparable inputs', () => {
    const record = createRecord({
      levelId: 'classic-002',
      repetition: 3,
      options: {
        heuristicId: 'assignment',
        heuristicWeight: 2,
        timeBudgetMs: 3_000,
        nodeBudget: 7_500,
      },
    });

    expect(toComparableRunInput(record)).toEqual({
      levelId: 'classic-002',
      repetition: 3,
      solver: {
        algorithmId: 'bfsPush',
        heuristicId: 'assignment',
        heuristicWeight: 2,
        timeBudgetMs: 3_000,
        nodeBudget: 7_500,
      },
      environment: {
        userAgent: 'test-agent',
        hardwareConcurrency: 8,
        appVersion: 'test-build',
      },
      warmupEnabled: false,
      warmupRepetitions: 0,
    });
  });

  it('returns null when a run record does not include comparable metadata', () => {
    expect(
      toComparableRunInput(
        createRecord({
          comparableMetadata: undefined,
        }),
      ),
    ).toBeNull();
  });

  it('builds a stable fingerprint regardless of record order', () => {
    const left = createRecord({
      id: 'record-a',
      runId: 'run-a',
      sequence: 2,
      repetition: 2,
    });
    const right = createRecord({
      id: 'record-b',
      runId: 'run-b',
      sequence: 1,
      repetition: 1,
      levelId: 'classic-002',
    });

    const original = buildSuiteComparisonInfo([left, right]);
    const reversed = buildSuiteComparisonInfo([right, left]);

    expect(original.issues).toEqual([]);
    expect(original.inputs).toHaveLength(2);
    expect(original.fingerprint).toBeTruthy();
    expect(original.fingerprint).toBe(reversed.fingerprint);
    expect(original.inputs).toEqual(reversed.inputs);
  });

  it('changes the fingerprint when comparable inputs differ', () => {
    const baseline = buildSuiteComparisonInfo([createRecord()]);
    const changedBudget = buildSuiteComparisonInfo([
      createRecord({
        options: {
          timeBudgetMs: 2_000,
          nodeBudget: 5_000,
        },
      }),
    ]);

    expect(baseline.fingerprint).not.toBeNull();
    expect(changedBudget.fingerprint).not.toBeNull();
    expect(changedBudget.fingerprint).not.toBe(baseline.fingerprint);
  });

  it('treats empty measured suites as non-comparable', () => {
    expect(buildSuiteComparisonInfo([])).toEqual({
      fingerprint: null,
      inputs: [],
      issues: ['Benchmark suite has no measured results.'],
    });
  });

  it('fails closed when comparable metadata is missing', () => {
    const info = buildSuiteComparisonInfo([
      createRecord({
        runId: 'run-missing',
        comparableMetadata: undefined,
      }),
    ]);

    expect(info.fingerprint).toBeNull();
    expect(info.inputs).toEqual([]);
    expect(info.issues).toEqual(['Missing comparable metadata for run run-missing.']);
  });

  it('returns sorted comparable inputs even when some runs are missing metadata', () => {
    const info = buildSuiteComparisonInfo([
      createRecord({
        id: 'record-b',
        runId: 'run-b',
        levelId: 'classic-002',
        repetition: 2,
      }),
      createRecord({
        id: 'record-missing',
        runId: 'run-missing',
        comparableMetadata: undefined,
      }),
      createRecord({
        id: 'record-a',
        runId: 'run-a',
        levelId: 'classic-001',
        repetition: 1,
      }),
    ]);

    expect(info.fingerprint).toBeNull();
    expect(info.inputs.map((input) => `${input.levelId}:${input.repetition}`)).toEqual([
      'classic-001:1',
      'classic-002:2',
    ]);
    expect(info.issues).toEqual(['Missing comparable metadata for run run-missing.']);
  });

  it('normalizes omitted optional solver fields into the same fingerprint shape', () => {
    const minimalMetadataRecord = createRecord({
      id: 'record-minimal',
      runId: 'run-minimal',
      comparableMetadata: {
        solver: {
          algorithmId: 'bfsPush',
        },
        environment: {
          userAgent: 'test-agent',
          hardwareConcurrency: 8,
          appVersion: 'test-build',
        },
        warmupEnabled: false,
        warmupRepetitions: 0,
      },
    });
    const undefinedMetadataRecord = createRecord({
      id: 'record-undefined',
      runId: 'run-undefined',
      comparableMetadata: {
        solver: {
          algorithmId: 'bfsPush',
          heuristicId: undefined,
          heuristicWeight: undefined,
          timeBudgetMs: undefined,
          nodeBudget: undefined,
          enableSpectatorStream: undefined,
        },
        environment: {
          userAgent: 'test-agent',
          hardwareConcurrency: 8,
          appVersion: 'test-build',
        },
        warmupEnabled: false,
        warmupRepetitions: 0,
      },
    });

    expect(buildSuiteComparisonInfo([minimalMetadataRecord]).fingerprint).toBe(
      buildSuiteComparisonInfo([undefinedMetadataRecord]).fingerprint,
    );
  });
});
