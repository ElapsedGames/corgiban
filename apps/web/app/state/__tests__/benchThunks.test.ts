import { describe, expect, it, vi } from 'vitest';

import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
} from '@corgiban/benchmarks';
import { builtinLevels } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';

import type { BenchmarkStorage } from '../../infra/persistence/benchmarkStorage.client';
import {
  BenchmarkRunCancelledError,
  type BenchmarkPort,
  type BenchmarkRunRecord,
} from '../../ports/benchmarkPort';
import { createNoopSolverPort } from '../../ports/solverPort';
import {
  benchResultRecorded,
  benchResultsReplaced,
  benchRunCancelRequested,
  benchRunStarted,
  setSuiteAlgorithmIds,
  setSuiteLevelIds,
  setSuiteNodeBudget,
  setSuiteRepetitions,
  setSuiteTimeBudgetMs,
} from '../benchSlice';
import {
  cancelBenchRun,
  clearBenchResults,
  importBenchmarkReport,
  importLevelPackSelection,
  initializeBench,
  runBenchSuite,
} from '../benchThunks';
import { createAppStore } from '../store';

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'bench-1',
    runId: 'bench-1-1',
    sequence: 1,
    levelId: builtinLevels[0]?.id ?? 'classic-001',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1000,
      nodeBudget: 500,
    },
    status: 'unsolved',
    metrics: {
      elapsedMs: 10,
      expanded: 2,
      generated: 3,
      maxDepth: 1,
      maxFrontier: 2,
      pushCount: 1,
      moveCount: 2,
    },
    startedAtMs: 10,
    finishedAtMs: 20,
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    ...overrides,
  };
}

function createBenchmarkPortMock(): BenchmarkPort {
  return {
    runSuite: vi.fn(async () => []),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
  };
}

function createBenchmarkStorageMock(): BenchmarkStorage {
  return {
    init: vi.fn(async () => ({
      persistOutcome: 'granted' as const,
      repositoryHealth: 'durable' as const,
    })),
    loadResults: vi.fn(async () => []),
    saveResult: vi.fn(async () => undefined),
    replaceResults: vi.fn(async () => undefined),
    clearResults: vi.fn(async () => undefined),
    getRepositoryHealth: vi.fn(() => 'durable'),
    getLastRepositoryError: vi.fn(() => null),
    dispose: vi.fn(),
  };
}

describe('benchThunks', () => {
  it('returns early when benchmark storage is unavailable during initialization', async () => {
    const dispatch = vi.fn();
    const getState = () => ({
      settings: { debug: false },
      bench: {},
    });

    await initializeBench()(dispatch, getState as never, {
      solverPort: createNoopSolverPort(),
      benchmarkPort: undefined,
      benchmarkStorage: undefined,
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns early when benchmark port is unavailable', async () => {
    const dispatch = vi.fn();
    const getState = () => ({
      settings: { debug: false },
      bench: {
        suite: {
          levelIds: [builtinLevels[0]?.id ?? 'classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1000,
          nodeBudget: 500,
        },
        status: 'idle',
      },
    });

    await runBenchSuite()(dispatch, getState as never, {
      solverPort: createNoopSolverPort(),
      benchmarkPort: undefined,
      benchmarkStorage: undefined,
    });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('records an error when computed total runs is zero', async () => {
    const dispatch = vi.fn();
    const getState = () => ({
      settings: { debug: false },
      bench: {
        suite: {
          levelIds: [builtinLevels[0]?.id ?? 'classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 0,
          timeBudgetMs: 1000,
          nodeBudget: 500,
        },
        status: 'idle',
      },
    });

    await runBenchSuite()(dispatch, getState as never, {
      solverPort: createNoopSolverPort(),
      benchmarkPort: createBenchmarkPortMock(),
      benchmarkStorage: undefined,
    });

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'bench/benchErrorRecorded',
        payload: 'Benchmark suite has no executable runs.',
      }),
    );
  });

  it('runs suites without benchmark storage and resolves valid level runtimes', async () => {
    const dispatch = vi.fn();
    const benchmarkPort = createBenchmarkPortMock();
    vi.mocked(benchmarkPort.runSuite).mockImplementation(async (request) => {
      const runtime = request.levelResolver(request.suite.levelIds[0] ?? 'missing');
      expect(runtime.levelId).toBe(request.suite.levelIds[0]);

      request.onResult?.(createResult({ suiteRunId: request.suiteRunId }));
      request.onProgress?.({
        suiteRunId: request.suiteRunId,
        totalRuns: 1,
        completedRuns: 1,
        latestResultId: 'result-1',
      });
      return [];
    });

    const levelId = builtinLevels[0]?.id ?? 'classic-001';
    const getState = () => ({
      settings: { debug: false },
      bench: {
        suite: {
          levelIds: [levelId],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1000,
          nodeBudget: 500,
        },
        status: 'idle',
      },
    });

    await runBenchSuite()(dispatch, getState as never, {
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage: undefined,
    });

    const actionTypes = dispatch.mock.calls.map((call) => call[0]?.type);
    expect(actionTypes).toContain('bench/benchResultRecorded');
    expect(actionTypes).toContain('bench/benchRunCompleted');
    expect(actionTypes).toContain('bench/benchErrorRecorded');
  });

  it('initializes bench diagnostics and persisted results', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const persistedResult = createResult();

    vi.mocked(benchmarkStorage.loadResults).mockResolvedValue([persistedResult]);

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(initializeBench());

    expect(store.getState().bench.diagnostics.persistOutcome).toBe('granted');
    expect(store.getState().bench.diagnostics.repositoryHealth).toBe('durable');
    expect(store.getState().bench.results).toEqual([persistedResult]);
    expect(benchmarkStorage.init).toHaveBeenCalledTimes(1);
    expect(benchmarkStorage.loadResults).toHaveBeenCalledTimes(1);

    store.dispose();
  });

  it('surfaces repository health degradation when persistence load fails despite granted persist outcome', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.init).mockResolvedValue({
      persistOutcome: 'granted',
      repositoryHealth: 'durable',
    } as const);
    vi.mocked(benchmarkStorage.getRepositoryHealth).mockReturnValue('memory-fallback');
    vi.mocked(benchmarkStorage.getLastRepositoryError).mockReturnValue(
      'Failed to load benchmark runs from repository.',
    );

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(initializeBench());

    expect(store.getState().bench.diagnostics.persistOutcome).toBe('granted');
    expect(store.getState().bench.diagnostics.repositoryHealth).toBe('memory-fallback');
    expect(store.getState().bench.diagnostics.lastError).toBe(
      'Failed to load benchmark runs from repository.',
    );

    store.dispose();
  });

  it('runs a benchmark suite and persists each result', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    let persistedResult: BenchmarkRunRecord | undefined;

    vi.mocked(benchmarkPort.runSuite).mockImplementation(async (request) => {
      const result = createResult({
        suiteRunId: request.suiteRunId,
        runId: `${request.suiteRunId}-1`,
      });
      persistedResult = result;
      request.onResult?.(result);
      request.onProgress?.({
        suiteRunId: request.suiteRunId,
        totalRuns: 1,
        completedRuns: 1,
        latestResultId: result.id,
      });
      return [result];
    });
    vi.mocked(benchmarkStorage.loadResults).mockImplementation(async () =>
      persistedResult ? [persistedResult] : [],
    );

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const levelId = builtinLevels[0]?.id ?? 'classic-001';
    store.dispatch(setSuiteLevelIds([levelId]));
    store.dispatch(setSuiteAlgorithmIds(['bfsPush']));
    store.dispatch(setSuiteRepetitions(1));
    store.dispatch(setSuiteTimeBudgetMs(1000));
    store.dispatch(setSuiteNodeBudget(500));

    await store.dispatch(runBenchSuite());

    const state = store.getState().bench;
    expect(state.status).toBe('completed');
    expect(state.results).toHaveLength(1);
    expect(state.progress.completedRuns).toBe(1);
    expect(benchmarkStorage.saveResult).toHaveBeenCalledTimes(1);
    expect(benchmarkStorage.loadResults).toHaveBeenCalledTimes(1);

    store.dispose();
  });

  it('reconciles in-memory results with persisted retention after suite completion', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();

    vi.mocked(benchmarkPort.runSuite).mockImplementation(async (request) => {
      const first = createResult({
        id: 'suite-first',
        suiteRunId: request.suiteRunId,
        runId: `${request.suiteRunId}-1`,
        sequence: 1,
        repetition: 1,
      });
      const retained = createResult({
        id: 'suite-retained',
        suiteRunId: request.suiteRunId,
        runId: `${request.suiteRunId}-2`,
        sequence: 2,
        repetition: 2,
        finishedAtMs: first.finishedAtMs + 10,
        startedAtMs: first.startedAtMs + 10,
      });
      request.onResult?.(first);
      request.onResult?.(retained);
      request.onProgress?.({
        suiteRunId: request.suiteRunId,
        totalRuns: 2,
        completedRuns: 2,
        latestResultId: retained.id,
      });
      return [first, retained];
    });

    const retainedOnly = createResult({
      id: 'suite-retained',
      suiteRunId: 'retained-suite',
      runId: 'retained-run',
      sequence: 1,
      repetition: 1,
      finishedAtMs: 200,
      startedAtMs: 100,
    });
    vi.mocked(benchmarkStorage.loadResults).mockResolvedValue([retainedOnly]);

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const levelId = builtinLevels[0]?.id ?? 'classic-001';
    store.dispatch(setSuiteLevelIds([levelId]));
    store.dispatch(setSuiteAlgorithmIds(['bfsPush']));
    store.dispatch(setSuiteRepetitions(2));

    await store.dispatch(runBenchSuite());

    expect(benchmarkStorage.saveResult).toHaveBeenCalledTimes(2);
    expect(benchmarkStorage.loadResults).toHaveBeenCalledTimes(1);
    expect(store.getState().bench.results).toEqual([retainedOnly]);

    store.dispose();
  });

  it('cancels an active benchmark run', () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(benchRunStarted({ suiteRunId: 'bench-active', totalRuns: 4 }));
    store.dispatch(cancelBenchRun());

    expect(benchmarkPort.cancelSuite).toHaveBeenCalledWith('bench-active');
    expect(store.getState().bench.status).toBe('cancelling');

    store.dispose();
  });

  it('imports and clears benchmark reports', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const reportResult = createResult({ id: 'report-result' });
    vi.mocked(benchmarkStorage.loadResults).mockResolvedValue([reportResult]);
    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [reportResult],
        }),
      ),
    );

    expect(store.getState().bench.results).toEqual([reportResult]);
    expect(benchmarkStorage.replaceResults).toHaveBeenCalledWith([reportResult]);
    expect(benchmarkStorage.loadResults).toHaveBeenCalled();

    await store.dispatch(clearBenchResults());

    expect(store.getState().bench.results).toEqual([]);
    expect(benchmarkStorage.clearResults).toHaveBeenCalledTimes(1);

    store.dispose();
  });

  it('records an error when benchmark initialization fails', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.init).mockRejectedValue(new Error('init failed'));

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(initializeBench());

    expect(store.getState().bench.diagnostics.lastError).toBe('init failed');
    store.dispose();
  });

  it('requires at least one selected level and algorithm before running', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(setSuiteLevelIds([]));
    await store.dispatch(runBenchSuite());
    expect(store.getState().bench.diagnostics.lastError).toContain('Select at least one level');
    expect(benchmarkPort.runSuite).not.toHaveBeenCalled();

    store.dispatch(setSuiteLevelIds([builtinLevels[0]?.id ?? 'classic-001']));
    store.dispatch(setSuiteAlgorithmIds([]));
    await store.dispatch(runBenchSuite());
    expect(store.getState().bench.diagnostics.lastError).toContain('Select at least one algorithm');
    expect(benchmarkPort.runSuite).not.toHaveBeenCalled();

    store.dispose();
  });

  it('does not start another suite while already running or cancelling', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(benchRunStarted({ suiteRunId: 'active', totalRuns: 1 }));
    await store.dispatch(runBenchSuite());
    expect(benchmarkPort.runSuite).not.toHaveBeenCalled();

    store.dispatch(benchRunCancelRequested({ suiteRunId: 'active' }));
    await store.dispatch(runBenchSuite());
    expect(benchmarkPort.runSuite).not.toHaveBeenCalled();

    store.dispose();
  });

  it('marks suite cancelled when benchmark port throws cancellation errors', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();

    vi.mocked(benchmarkPort.runSuite).mockRejectedValueOnce(new BenchmarkRunCancelledError());

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(runBenchSuite());
    expect(store.getState().bench.status).toBe('cancelled');
    expect(store.getState().bench.activeSuiteRunId).toBeNull();

    vi.mocked(benchmarkPort.runSuite).mockRejectedValueOnce(new Error('run cancelled by user'));
    await store.dispatch(runBenchSuite());
    expect(store.getState().bench.status).toBe('failed');
    expect(store.getState().bench.diagnostics.lastError).toBe('run cancelled by user');

    store.dispose();
  });

  it('replaces imported results with retained persistence state', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const importedResultA = createResult({ id: 'import-a' });
    const importedResultB = createResult({ id: 'import-b', finishedAtMs: 30, startedAtMs: 20 });
    const retainedResult = importedResultB;
    vi.mocked(benchmarkStorage.loadResults).mockResolvedValue([retainedResult]);

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [importedResultA, importedResultB],
        }),
      ),
    );

    expect(benchmarkStorage.replaceResults).toHaveBeenCalledWith([
      importedResultA,
      importedResultB,
    ]);
    expect(benchmarkStorage.loadResults).toHaveBeenCalled();
    expect(store.getState().bench.results).toEqual([retainedResult]);

    store.dispose();
  });

  it('marks suite failed when benchmark port throws non-cancellation errors', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkPort.runSuite).mockRejectedValueOnce('port failure');

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(runBenchSuite());
    expect(store.getState().bench.status).toBe('failed');
    expect(store.getState().bench.diagnostics.lastError).toBe('port failure');

    store.dispose();
  });

  it('fails run when suite references an unknown level id', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkPort.runSuite).mockImplementation(async (request) => {
      request.levelResolver(request.suite.levelIds[0] ?? 'missing-level-id');
      return [];
    });
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(setSuiteLevelIds(['missing-level-id']));
    await store.dispatch(runBenchSuite());

    expect(store.getState().bench.status).toBe('failed');
    expect(store.getState().bench.diagnostics.lastError).toContain('Unknown level id');
    store.dispose();
  });

  it('records clear error when persistence clear fails', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.clearResults).mockRejectedValue(new Error('clear failed'));

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(clearBenchResults());
    expect(store.getState().bench.diagnostics.lastError).toBe('clear failed');
    store.dispose();
  });

  it('reconciles fallback state when clear throws after mutating storage memory', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.clearResults).mockRejectedValue(new Error('clear failed'));
    vi.mocked(benchmarkStorage.loadResults).mockResolvedValue([]);
    vi.mocked(benchmarkStorage.getRepositoryHealth).mockReturnValue('memory-fallback');
    vi.mocked(benchmarkStorage.getLastRepositoryError).mockReturnValue(
      'Failed to clear benchmark results in repository.',
    );

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(benchResultsReplaced([createResult({ id: 'stale-result' })]));

    await store.dispatch(clearBenchResults());

    expect(store.getState().bench.results).toEqual([]);
    expect(store.getState().bench.diagnostics.repositoryHealth).toBe('memory-fallback');
    expect(store.getState().bench.diagnostics.lastError).toBe('clear failed');
    expect(benchmarkStorage.loadResults).toHaveBeenCalledTimes(1);
    store.dispose();
  });

  it('does not clear persisted or in-memory results while status is running or cancelling', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const activeResult = createResult({ id: 'active-result' });
    store.dispatch(benchResultRecorded(activeResult));
    store.dispatch(benchRunStarted({ suiteRunId: 'bench-active', totalRuns: 2 }));

    await store.dispatch(clearBenchResults());
    expect(benchmarkStorage.clearResults).not.toHaveBeenCalled();
    expect(store.getState().bench.results).toEqual([activeResult]);

    store.dispatch(benchRunCancelRequested({ suiteRunId: 'bench-active' }));
    await store.dispatch(clearBenchResults());
    expect(benchmarkStorage.clearResults).not.toHaveBeenCalled();
    expect(store.getState().bench.results).toEqual([activeResult]);

    store.dispose();
  });

  it('does not import benchmark reports while status is running or cancelling', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const activeResult = createResult({ id: 'active-report-result' });
    const importedResult = createResult({ id: 'imported-report-result' });
    const reportPayload = JSON.stringify({
      type: BENCHMARK_REPORT_TYPE,
      version: BENCHMARK_REPORT_VERSION,
      exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
      results: [importedResult],
    });

    store.dispatch(benchResultsReplaced([activeResult]));
    store.dispatch(benchRunStarted({ suiteRunId: 'bench-import-active', totalRuns: 2 }));

    await store.dispatch(importBenchmarkReport(reportPayload));
    expect(benchmarkStorage.replaceResults).not.toHaveBeenCalled();
    expect(store.getState().bench.results).toEqual([activeResult]);

    store.dispatch(benchRunCancelRequested({ suiteRunId: 'bench-import-active' }));
    await store.dispatch(importBenchmarkReport(reportPayload));
    expect(benchmarkStorage.replaceResults).not.toHaveBeenCalled();
    expect(store.getState().bench.results).toEqual([activeResult]);

    store.dispose();
  });

  it('imports level-pack selections through workflow and blocks while suite is active', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const firstLevelId = builtinLevels[0]?.id ?? 'classic-001';
    const secondLevelId = builtinLevels[1]?.id ?? firstLevelId;
    const expectedLevelIds =
      firstLevelId === secondLevelId ? [firstLevelId] : [firstLevelId, secondLevelId];

    await store.dispatch(
      importLevelPackSelection(
        JSON.stringify({
          levelIds: [firstLevelId, 'custom-level-id', secondLevelId, firstLevelId],
        }),
      ),
    );

    expect(store.getState().bench.suite.levelIds).toEqual(expectedLevelIds);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    expect(store.getState().bench.diagnostics.lastNotice).toContain('unrecognized ID was skipped');

    const activeSuiteLevelIds = [...store.getState().bench.suite.levelIds];
    const replacementLevelId = builtinLevels[2]?.id ?? secondLevelId;

    store.dispatch(benchRunStarted({ suiteRunId: 'bench-level-pack-active', totalRuns: 2 }));
    await store.dispatch(
      importLevelPackSelection(
        JSON.stringify({
          levelIds: [replacementLevelId],
        }),
      ),
    );

    expect(store.getState().bench.suite.levelIds).toEqual(activeSuiteLevelIds);

    store.dispatch(benchRunCancelRequested({ suiteRunId: 'bench-level-pack-active' }));
    await store.dispatch(
      importLevelPackSelection(
        JSON.stringify({
          levelIds: [firstLevelId],
        }),
      ),
    );
    expect(store.getState().bench.suite.levelIds).toEqual(activeSuiteLevelIds);

    store.dispose();
  });

  it('records import errors for invalid benchmark report payloads', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(importBenchmarkReport('null'));
    expect(store.getState().bench.diagnostics.lastError).toContain(
      'Benchmark report must be a JSON object.',
    );

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: 'not-corgiban',
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [],
        }),
      ),
    );
    expect(store.getState().bench.diagnostics.lastError).toContain(
      'Unsupported benchmark report type.',
    );

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
        }),
      ),
    );
    expect(store.getState().bench.diagnostics.lastError).toContain(
      'Benchmark report is missing results.',
    );

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [{}],
        }),
      ),
    );
    expect(store.getState().bench.diagnostics.lastError).toContain(
      'Benchmark report contains invalid result entries.',
    );

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [null],
        }),
      ),
    );
    expect(store.getState().bench.diagnostics.lastError).toContain(
      'Benchmark report contains invalid result entries.',
    );

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION + 1,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [],
        }),
      ),
    );
    expect(store.getState().bench.diagnostics.lastError).toContain(
      `Unsupported benchmark report version. Expected ${BENCHMARK_REPORT_VERSION}.`,
    );

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: 'single-suite-snapshot',
          results: [],
        }),
      ),
    );
    expect(store.getState().bench.diagnostics.lastError).toContain(
      `Unsupported benchmark report export model. Expected \"${BENCHMARK_REPORT_EXPORT_MODEL}\".`,
    );

    const oversizedJson = 'x'.repeat(MAX_IMPORT_BYTES + 1);
    await store.dispatch(importBenchmarkReport(oversizedJson));
    expect(store.getState().bench.diagnostics.lastError).toContain('Benchmark report is too large');

    store.dispose();
  });

  it('reconciles fallback state when import replace throws after mutating storage memory', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const previousResult = createResult({ id: 'previous-result' });
    const importedResult = createResult({ id: 'imported-result' });
    const fallbackRetainedResult = createResult({ id: 'fallback-retained' });
    vi.mocked(benchmarkStorage.replaceResults).mockRejectedValue(new Error('replace failed'));
    vi.mocked(benchmarkStorage.loadResults).mockResolvedValue([fallbackRetainedResult]);
    vi.mocked(benchmarkStorage.getRepositoryHealth).mockReturnValue('memory-fallback');
    vi.mocked(benchmarkStorage.getLastRepositoryError).mockReturnValue(
      'Failed to replace benchmark results in repository.',
    );

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(benchResultsReplaced([previousResult]));

    await store.dispatch(
      importBenchmarkReport(
        JSON.stringify({
          type: BENCHMARK_REPORT_TYPE,
          version: BENCHMARK_REPORT_VERSION,
          exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
          results: [importedResult],
        }),
      ),
    );

    expect(benchmarkStorage.replaceResults).toHaveBeenCalledWith([importedResult]);
    expect(benchmarkStorage.loadResults).toHaveBeenCalledTimes(1);
    expect(store.getState().bench.results).toEqual([fallbackRetainedResult]);
    expect(store.getState().bench.diagnostics.repositoryHealth).toBe('memory-fallback');
    expect(store.getState().bench.diagnostics.lastError).toBe('replace failed');
    store.dispose();
  });

  it('converts unknown thrown values to the default benchmark error message', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.clearResults).mockRejectedValue({});

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    await store.dispatch(clearBenchResults());
    expect(store.getState().bench.diagnostics.lastError).toBe('Unknown benchmark error.');
    store.dispose();
  });

  it('surfaces persistence write errors to the UI when saveResult rejects', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.saveResult).mockRejectedValue(new Error('write failed'));

    vi.mocked(benchmarkPort.runSuite).mockImplementation(async (request) => {
      const result = createResult({ suiteRunId: request.suiteRunId });
      request.onResult?.(result);
      return [result];
    });

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    const levelId = builtinLevels[0]?.id ?? 'classic-001';
    store.dispatch(setSuiteLevelIds([levelId]));
    store.dispatch(setSuiteAlgorithmIds(['bfsPush']));
    store.dispatch(setSuiteRepetitions(1));
    store.dispatch(setSuiteTimeBudgetMs(1000));
    store.dispatch(setSuiteNodeBudget(500));

    await store.dispatch(runBenchSuite());

    expect(store.getState().bench.diagnostics.lastError).toBe('write failed');
    store.dispose();
  });

  it('cancelBenchRun is a no-op when no active run exists', () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      benchmarkStorage,
    });

    store.dispatch(cancelBenchRun());
    expect(benchmarkPort.cancelSuite).not.toHaveBeenCalled();

    store.dispose();
  });
});
