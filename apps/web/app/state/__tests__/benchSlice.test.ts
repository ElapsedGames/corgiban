import { describe, expect, it } from 'vitest';

import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';
import {
  benchErrorRecorded,
  benchPersistOutcomeRecorded,
  benchNoticeRecorded,
  benchPerfEntriesCleared,
  benchPerfEntriesObserved,
  benchResultRecorded,
  benchRepositoryHealthRecorded,
  benchResultsCleared,
  benchResultsLoaded,
  benchRunCancelled,
  benchRunCancelRequested,
  benchRunCompleted,
  benchRunFailed,
  benchRunProgressUpdated,
  benchRunStarted,
  benchSlice,
  setSuiteNodeBudget,
  setSuiteRepetitions,
  setSuiteTimeBudgetMs,
  toggleSuiteAlgorithmId,
  toggleSuiteLevelId,
} from '../benchSlice';

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'bench-1',
    runId: 'bench-1-1',
    sequence: 1,
    levelId: 'corgiban-test-18',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1000,
      nodeBudget: 500,
    },
    status: 'unsolved',
    metrics: {
      elapsedMs: 50,
      expanded: 20,
      generated: 40,
      maxDepth: 6,
      maxFrontier: 12,
      pushCount: 3,
      moveCount: 9,
    },
    startedAtMs: 10,
    finishedAtMs: 60,
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    ...overrides,
  };
}

describe('benchSlice', () => {
  it('returns initial state', () => {
    const state = benchSlice.reducer(undefined, { type: 'unknown' });

    expect(state.status).toBe('idle');
    expect(state.activeSuiteRunId).toBeNull();
    expect(state.suite.repetitions).toBe(1);
    expect(state.suite.timeBudgetMs).toBeGreaterThan(0);
    expect(state.suite.nodeBudget).toBeGreaterThan(0);
    expect(state.results).toEqual([]);
    expect(state.diagnostics.persistOutcome).toBeNull();
    expect(state.diagnostics.repositoryHealth).toBeNull();
    expect(state.diagnostics.lastNotice).toBeNull();
  });

  it('toggles suite selections and clamps positive numeric values', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });

    const originalLevelIds = state.suite.levelIds;
    state = benchSlice.reducer(state, toggleSuiteLevelId('corgiban-test-18'));
    expect(state.suite.levelIds).not.toEqual(originalLevelIds);
    state = benchSlice.reducer(state, toggleSuiteLevelId('corgiban-test-18'));
    expect([...state.suite.levelIds].sort()).toEqual([...originalLevelIds].sort());

    state = benchSlice.reducer(state, toggleSuiteAlgorithmId('idaStarPush'));
    expect(state.suite.algorithmIds.includes('idaStarPush')).toBe(true);
    state = benchSlice.reducer(state, toggleSuiteAlgorithmId('idaStarPush'));
    expect(state.suite.algorithmIds.includes('idaStarPush')).toBe(false);

    state = benchSlice.reducer(state, setSuiteRepetitions(4));
    state = benchSlice.reducer(state, setSuiteTimeBudgetMs(1234));
    state = benchSlice.reducer(state, setSuiteNodeBudget(5678));

    expect(state.suite.repetitions).toBe(4);
    expect(state.suite.timeBudgetMs).toBe(1234);
    expect(state.suite.nodeBudget).toBe(5678);

    state = benchSlice.reducer(state, setSuiteRepetitions(0));
    state = benchSlice.reducer(state, setSuiteTimeBudgetMs(-1));
    state = benchSlice.reducer(state, setSuiteNodeBudget(0));

    expect(state.suite.repetitions).toBe(4);
    expect(state.suite.timeBudgetMs).toBe(1234);
    expect(state.suite.nodeBudget).toBe(5678);
  });

  it('tracks run lifecycle and results', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });

    state = benchSlice.reducer(state, benchRunStarted({ suiteRunId: 'bench-1', totalRuns: 2 }));
    state = benchSlice.reducer(
      state,
      benchRunProgressUpdated({
        suiteRunId: 'bench-1',
        totalRuns: 2,
        completedRuns: 1,
        latestResultId: 'result-1',
      }),
    );
    state = benchSlice.reducer(state, benchResultRecorded(createResult()));
    state = benchSlice.reducer(state, benchRunCompleted({ suiteRunId: 'bench-1' }));

    expect(state.status).toBe('completed');
    expect(state.activeSuiteRunId).toBeNull();
    expect(state.progress.completedRuns).toBe(1);
    expect(state.progress.latestResultId).toBe('result-1');
    expect(state.results).toHaveLength(1);
  });

  it('ignores duplicate result ids in incremental benchResultRecorded updates', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });
    const first = createResult({
      id: 'dup-id',
      metrics: { ...createResult().metrics, elapsedMs: 10 },
    });
    const duplicate = createResult({
      id: 'dup-id',
      metrics: { ...createResult().metrics, elapsedMs: 99 },
    });

    state = benchSlice.reducer(state, benchResultRecorded(first));
    state = benchSlice.reducer(state, benchResultRecorded(duplicate));

    expect(state.results).toHaveLength(1);
    expect(state.results[0]?.metrics.elapsedMs).toBe(10);
  });

  it('ignores stale lifecycle updates and captures failures', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });

    state = benchSlice.reducer(state, benchRunStarted({ suiteRunId: 'bench-1', totalRuns: 1 }));
    state = benchSlice.reducer(
      state,
      benchRunProgressUpdated({ suiteRunId: 'bench-stale', totalRuns: 1, completedRuns: 1 }),
    );
    state = benchSlice.reducer(
      state,
      benchRunFailed({ suiteRunId: 'bench-1', message: 'Run failed unexpectedly.' }),
    );

    expect(state.status).toBe('failed');
    expect(state.diagnostics.lastError).toBe('Run failed unexpectedly.');

    state = benchSlice.reducer(state, benchRunCancelled({ suiteRunId: 'bench-stale' }));
    expect(state.status).toBe('failed');
  });

  it('handles missing latestResultId and ignores stale cancel/complete/fail actions', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });

    state = benchSlice.reducer(state, benchRunStarted({ suiteRunId: 'bench-1', totalRuns: 2 }));
    state = benchSlice.reducer(
      state,
      benchRunProgressUpdated({
        suiteRunId: 'bench-1',
        totalRuns: 2,
        completedRuns: 1,
      }),
    );

    expect(state.progress.latestResultId).toBeNull();

    state = benchSlice.reducer(state, benchRunCancelRequested({ suiteRunId: 'bench-stale' }));
    expect(state.status).toBe('running');

    state = benchSlice.reducer(state, benchRunCompleted({ suiteRunId: 'bench-stale' }));
    expect(state.status).toBe('running');
    expect(state.activeSuiteRunId).toBe('bench-1');

    state = benchSlice.reducer(
      state,
      benchRunFailed({ suiteRunId: 'bench-stale', message: 'stale failure' }),
    );
    expect(state.status).toBe('running');
    expect(state.diagnostics.lastError).toBeNull();
  });

  it('ignores benchResultsCleared while a suite is active', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });

    state = benchSlice.reducer(state, benchRunStarted({ suiteRunId: 'bench-1', totalRuns: 2 }));
    state = benchSlice.reducer(
      state,
      benchRunProgressUpdated({
        suiteRunId: 'bench-1',
        totalRuns: 2,
        completedRuns: 1,
        latestResultId: 'result-1',
      }),
    );
    state = benchSlice.reducer(state, benchResultRecorded(createResult()));
    state = benchSlice.reducer(state, benchResultsCleared());

    expect(state.results).toHaveLength(1);
    expect(state.progress.totalRuns).toBe(2);
    expect(state.progress.completedRuns).toBe(1);

    state = benchSlice.reducer(state, benchRunCancelRequested({ suiteRunId: 'bench-1' }));
    state = benchSlice.reducer(state, benchResultsCleared());

    expect(state.status).toBe('cancelling');
    expect(state.results).toHaveLength(1);
    expect(state.progress.totalRuns).toBe(2);
    expect(state.progress.completedRuns).toBe(1);
  });

  it('stores persistence diagnostics, loaded results, and perf entries', () => {
    let state = benchSlice.reducer(undefined, { type: 'unknown' });

    state = benchSlice.reducer(state, benchPersistOutcomeRecorded('granted'));
    state = benchSlice.reducer(state, benchRepositoryHealthRecorded('durable'));
    state = benchSlice.reducer(state, benchNoticeRecorded('Imported 1 level.'));
    state = benchSlice.reducer(state, benchErrorRecorded('Write failed.'));
    state = benchSlice.reducer(
      state,
      benchResultsLoaded([
        createResult({ id: 'result-2', finishedAtMs: 100 }),
        createResult({ id: 'result-1', finishedAtMs: 50 }),
      ]),
    );

    expect(state.diagnostics.persistOutcome).toBe('granted');
    expect(state.diagnostics.repositoryHealth).toBe('durable');
    expect(state.diagnostics.lastNotice).toBeNull();
    expect(state.results.map((result) => result.id)).toEqual(['result-1', 'result-2']);

    state = benchSlice.reducer(
      state,
      benchPerfEntriesObserved([
        {
          name: 'bench:solve-roundtrip:bench-1-1',
          entryType: 'measure',
          startTime: 10,
          duration: 22,
        },
      ]),
    );

    expect(state.perfEntries).toHaveLength(1);

    state = benchSlice.reducer(state, benchPerfEntriesCleared());
    state = benchSlice.reducer(state, benchResultsCleared());

    expect(state.perfEntries).toEqual([]);
    expect(state.results).toEqual([]);
    expect(state.progress.totalRuns).toBe(0);
  });
});
