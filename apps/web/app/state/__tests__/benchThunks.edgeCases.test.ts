import { describe, expect, it, vi } from 'vitest';

import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
} from '@corgiban/benchmarks';
import { builtinLevels } from '@corgiban/levels';

import type { PersistencePort } from '../../ports/persistencePort';
import { LEVEL_PACK_TYPE, LEVEL_PACK_VERSION } from '../../bench/levelPackImport';
import type { BenchmarkPort, BenchmarkRunRecord } from '../../ports/benchmarkPort';
import { createNoopSolverPort } from '../../ports/solverPort';
import { benchResultsReplaced } from '../benchSlice';
import {
  clearBenchResults,
  importBenchmarkReport,
  importLevelPackSelection,
  initializeBench,
  runBenchSuite,
} from '../benchThunks';
import { createAppStore } from '../store';

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'edge-result-1',
    suiteRunId: 'edge-suite-1',
    runId: 'edge-run-1',
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

function createBenchmarkStorageMock(): PersistencePort {
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

function createReportPayload(results: BenchmarkRunRecord[]): string {
  return JSON.stringify({
    type: BENCHMARK_REPORT_TYPE,
    version: BENCHMARK_REPORT_VERSION,
    exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
    results,
  });
}

function createLevelPackPayload(levelIds: string[]): string {
  return JSON.stringify({
    type: LEVEL_PACK_TYPE,
    version: LEVEL_PACK_VERSION,
    levelIds,
  });
}

describe('benchThunks edge cases', () => {
  it('records load error when initializeBench loadResults rejects with a string', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.loadResults).mockRejectedValue('load exploded');

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    await store.dispatch(initializeBench());

    expect(store.getState().bench.diagnostics.lastError).toBe('load exploded');
    store.dispose();
  });

  it('treats cancellation code marker objects as cancellation errors', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkPort.runSuite).mockRejectedValue({ code: 'BENCHMARK_RUN_CANCELLED' });

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    await store.dispatch(runBenchSuite());

    expect(store.getState().bench.status).toBe('cancelled');
    store.dispose();
  });

  it('treats errors named BenchmarkRunCancelledError as cancellation errors', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const cancellationByName = new Error('cancelled by name');
    cancellationByName.name = 'BenchmarkRunCancelledError';
    vi.mocked(benchmarkPort.runSuite).mockRejectedValue(cancellationByName);

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    await store.dispatch(runBenchSuite());

    expect(store.getState().bench.status).toBe('cancelled');
    store.dispose();
  });

  it('clears in-memory results when storage is unavailable', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: undefined,
    });
    store.dispatch(benchResultsReplaced([createResult({ id: 'keep-me' })]));

    await expect(store.dispatch(clearBenchResults())).resolves.toBeUndefined();

    expect(store.getState().bench.results).toEqual([]);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    store.dispose();
  });

  it('imports benchmark reports directly into state when storage is unavailable', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: undefined,
    });

    const imported = createResult({ id: 'imported-without-storage' });
    await expect(
      store.dispatch(importBenchmarkReport(createReportPayload([imported]))),
    ).resolves.toBe(undefined);

    expect(store.getState().bench.results).toEqual([imported]);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    store.dispose();
  });

  it('records parse errors when benchmark report JSON is malformed', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    await expect(store.dispatch(importBenchmarkReport('{not-json'))).resolves.toBeUndefined();

    expect(benchmarkStorage.replaceResults).not.toHaveBeenCalled();
    expect(store.getState().bench.diagnostics.lastError).toBeTruthy();
    store.dispose();
  });

  it('records a clear error when imported level-pack ids are all unknown', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });
    const beforeLevelIds = [...store.getState().bench.suite.levelIds];

    await expect(
      store.dispatch(importLevelPackSelection(createLevelPackPayload(['custom-only']))),
    ).resolves.toBeUndefined();

    expect(store.getState().bench.suite.levelIds).toEqual(beforeLevelIds);
    expect(store.getState().bench.diagnostics.lastError).toContain(
      'No known built-in level ids were found',
    );
    expect(store.getState().bench.diagnostics.lastNotice).toBeNull();
    store.dispose();
  });

  it('records malformed level-pack payload errors and clears stale notices', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    await expect(
      store.dispatch(
        importLevelPackSelection(
          createLevelPackPayload([builtinLevels[0]?.id ?? 'classic-001', 'custom-level']),
        ),
      ),
    ).resolves.toBeUndefined();
    expect(store.getState().bench.diagnostics.lastNotice).not.toBeNull();

    await expect(store.dispatch(importLevelPackSelection('{bad-json'))).resolves.toBeUndefined();

    expect(store.getState().bench.diagnostics.lastError).toBeTruthy();
    expect(store.getState().bench.diagnostics.lastNotice).toBeNull();
    store.dispose();
  });

  it('keeps original clear error even when fallback reconciliation also fails', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.clearResults).mockRejectedValue(new Error('clear failed'));
    vi.mocked(benchmarkStorage.loadResults).mockRejectedValue(new Error('reload failed'));

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });
    const existing = createResult({ id: 'existing-before-clear' });
    store.dispatch(benchResultsReplaced([existing]));

    await expect(store.dispatch(clearBenchResults())).resolves.toBeUndefined();

    expect(store.getState().bench.results).toEqual([existing]);
    expect(store.getState().bench.diagnostics.lastError).toBe('clear failed');
    store.dispose();
  });

  it('keeps original import replace error even when fallback reconciliation also fails', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    vi.mocked(benchmarkStorage.replaceResults).mockRejectedValue(new Error('replace failed'));
    vi.mocked(benchmarkStorage.loadResults).mockRejectedValue(new Error('reload failed'));

    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });
    const previous = createResult({ id: 'previous-before-import' });
    const imported = createResult({ id: 'import-attempt' });
    store.dispatch(benchResultsReplaced([previous]));

    await expect(
      store.dispatch(importBenchmarkReport(createReportPayload([imported]))),
    ).resolves.toBe(undefined);

    expect(store.getState().bench.results).toEqual([previous]);
    expect(store.getState().bench.diagnostics.lastError).toBe('replace failed');
    store.dispose();
  });
});
