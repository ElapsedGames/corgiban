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

  it('sorts inputs by levelId ascending (ordinal, not locale-aware)', () => {
    // Ordinal comparison: 'b' (0x62) < 'a\u0301' locale-collated in some locales, but
    // ordinal byte order is well-defined. We test a simpler, unambiguous case:
    // digits before letters ('1' < 'a') holds under both ordinal and most locales,
    // but the key regression is that the sort is field-by-field, not by JSON string.
    const recordA = createRecord({ id: 'r-a', runId: 'run-a', levelId: 'level-a' });
    const recordB = createRecord({ id: 'r-b', runId: 'run-b', levelId: 'level-b' });
    const recordC = createRecord({ id: 'r-c', runId: 'run-c', levelId: 'level-c' });

    const info = buildSuiteComparisonInfo([recordC, recordA, recordB]);

    expect(info.inputs.map((i) => i.levelId)).toEqual(['level-a', 'level-b', 'level-c']);
  });

  it('sorts inputs by repetition ascending (numeric) when levelIds are equal', () => {
    // repetition 10 must sort after repetition 2 numerically (not "10" < "2" lexicographically)
    const rep2 = createRecord({ id: 'r-2', runId: 'run-2', levelId: 'classic-001', repetition: 2 });
    const rep10 = createRecord({
      id: 'r-10',
      runId: 'run-10',
      levelId: 'classic-001',
      repetition: 10,
    });
    const rep1 = createRecord({ id: 'r-1', runId: 'run-1', levelId: 'classic-001', repetition: 1 });

    const info = buildSuiteComparisonInfo([rep10, rep2, rep1]);

    expect(info.inputs.map((i) => i.repetition)).toEqual([1, 2, 10]);
  });

  it('uses serialized JSON as a tiebreaker when levelId and repetition are identical', () => {
    // Two records with the same levelId and repetition but different solver configs.
    // The ordering must be deterministic (not arbitrary/random).
    const recordAlpha = createRecord({
      id: 'r-alpha',
      runId: 'run-alpha',
      levelId: 'classic-001',
      repetition: 1,
      comparableMetadata: {
        solver: { algorithmId: 'bfsPush', timeBudgetMs: 1_000 },
        environment: { userAgent: 'test-agent', hardwareConcurrency: 8, appVersion: 'test-build' },
        warmupEnabled: false,
        warmupRepetitions: 0,
      },
    });
    const recordBeta = createRecord({
      id: 'r-beta',
      runId: 'run-beta',
      levelId: 'classic-001',
      repetition: 1,
      comparableMetadata: {
        solver: { algorithmId: 'bfsPush', timeBudgetMs: 2_000 },
        environment: { userAgent: 'test-agent', hardwareConcurrency: 8, appVersion: 'test-build' },
        warmupEnabled: false,
        warmupRepetitions: 0,
      },
    });

    const forward = buildSuiteComparisonInfo([recordAlpha, recordBeta]);
    const reversed = buildSuiteComparisonInfo([recordBeta, recordAlpha]);

    // Both orderings must produce the same sorted result
    expect(forward.inputs).toEqual(reversed.inputs);
    // And the sort must be stable (timeBudgetMs 1000 serializes before 2000 in JSON)
    expect(forward.inputs[0].solver.timeBudgetMs).toBe(1_000);
    expect(forward.inputs[1].solver.timeBudgetMs).toBe(2_000);
  });

  it('sorts levelId before repetition (primary key is levelId, not repetition)', () => {
    // level-b rep-1 must sort after level-a rep-99, not before it
    const highRepLowLevel = createRecord({
      id: 'r-high',
      runId: 'run-high',
      levelId: 'level-a',
      repetition: 99,
    });
    const lowRepHighLevel = createRecord({
      id: 'r-low',
      runId: 'run-low',
      levelId: 'level-b',
      repetition: 1,
    });

    const info = buildSuiteComparisonInfo([lowRepHighLevel, highRepLowLevel]);

    expect(info.inputs[0].levelId).toBe('level-a');
    expect(info.inputs[0].repetition).toBe(99);
    expect(info.inputs[1].levelId).toBe('level-b');
    expect(info.inputs[1].repetition).toBe(1);
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
