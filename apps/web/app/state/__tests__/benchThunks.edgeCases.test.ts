import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
} from '@corgiban/benchmarks';
import { builtinLevels } from '@corgiban/levels';

import type { PersistencePort } from '../../ports/persistencePort';
import { LEVEL_PACK_TYPE, LEVEL_PACK_VERSION } from '../../bench/levelPackImport';
import { clearTemporaryLevels, getPlayableEntryByRef } from '../../levels/temporaryLevelCatalog';
import {
  getBenchmarkSuiteLevelRefs,
  type BenchmarkPort,
  type BenchmarkRunRecord,
} from '../../ports/benchmarkPort';
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
  const algorithmId = overrides.algorithmId ?? 'bfsPush';
  const options = overrides.options ?? {
    timeBudgetMs: 1000,
    nodeBudget: 500,
  };
  const environment = overrides.environment ?? {
    userAgent: 'test',
    hardwareConcurrency: 4,
    appVersion: 'test',
  };

  return {
    id: 'edge-result-1',
    suiteRunId: 'edge-suite-1',
    runId: 'edge-run-1',
    sequence: 1,
    levelId: builtinLevels[0]?.id ?? 'corgiban-test-18',
    algorithmId,
    repetition: 1,
    options,
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

function createLevelPackWithLevels(
  levels: Array<{ id: string; name?: string; rows?: string[] }>,
): string {
  return JSON.stringify({
    type: LEVEL_PACK_TYPE,
    version: LEVEL_PACK_VERSION,
    levels,
  });
}

describe('benchThunks edge cases', () => {
  afterEach(() => {
    clearTemporaryLevels();
  });

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

    const importedWarmup = createResult({
      id: 'imported-warmup-without-storage',
      runId: 'imported-warmup-run',
      warmup: true,
      comparableMetadata: {
        solver: {
          algorithmId: 'bfsPush',
          timeBudgetMs: 1000,
          nodeBudget: 500,
        },
        environment: {
          userAgent: 'test',
          hardwareConcurrency: 4,
          appVersion: 'test',
        },
        warmupEnabled: true,
        warmupRepetitions: 1,
      },
    });
    const imported = createResult({
      id: 'imported-without-storage',
      runId: 'imported-measured-run',
    });
    await expect(
      store.dispatch(importBenchmarkReport(createReportPayload([importedWarmup, imported]))),
    ).resolves.toBe(undefined);

    expect(store.getState().bench.results).toEqual([imported]);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    expect(store.getState().bench.diagnostics.lastNotice).toContain(
      'Imported report skipped 1 warm-up run across 1 suite.',
    );
    store.dispose();
  });

  it('records an import notice when imported runs lack comparable metadata', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    const imported = createResult({
      id: 'imported-missing-comparable-metadata',
      suiteRunId: 'import-suite',
      runId: 'import-run',
      comparableMetadata: undefined,
    });

    await expect(
      store.dispatch(importBenchmarkReport(createReportPayload([imported]))),
    ).resolves.toBeUndefined();

    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    expect(store.getState().bench.diagnostics.lastNotice).toContain(
      'Imported report includes 1 run without comparable metadata across 1 suite.',
    );
    expect(store.getState().bench.diagnostics.lastNotice).toContain(
      'Affected suites: import-suite.',
    );
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
      'No usable level ids were found',
    );
    expect(store.getState().bench.diagnostics.lastNotice).toBeNull();
    store.dispose();
  });

  it('imports custom level definitions into the active bench suite selection', async () => {
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
          createLevelPackWithLevels([
            {
              id: 'custom-bench-001',
              name: 'Custom Bench Level',
              rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
            },
          ]),
        ),
      ),
    ).resolves.toBeUndefined();

    const importedLevelRefs = getBenchmarkSuiteLevelRefs(store.getState().bench.suite);
    expect(importedLevelRefs).toHaveLength(1);
    expect(importedLevelRefs[0] ?? '').toMatch(/^temp:/);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    expect(store.getState().bench.diagnostics.lastNotice ?? '').toContain(
      'temporary custom level is now available in Play, Lab, and Bench',
    );
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
          createLevelPackPayload([builtinLevels[0]?.id ?? 'corgiban-test-18', 'custom-level']),
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

  it('imports a dual-field payload with custom levels into the bench suite', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    const knownId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    const dualFieldPayload = JSON.stringify({
      type: LEVEL_PACK_TYPE,
      version: LEVEL_PACK_VERSION,
      levelIds: [knownId, 'custom-dual-001'],
      levels: [
        { id: knownId },
        {
          id: 'custom-dual-001',
          name: 'Dual Custom',
          rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
        },
      ],
    });

    await expect(
      store.dispatch(importLevelPackSelection(dualFieldPayload)),
    ).resolves.toBeUndefined();

    const importedLevelRefs = getBenchmarkSuiteLevelRefs(store.getState().bench.suite);
    expect(importedLevelRefs).toHaveLength(2);
    expect(importedLevelRefs.every((levelRef) => levelRef.startsWith('temp:'))).toBe(true);
    expect(
      importedLevelRefs.map((levelRef) => getPlayableEntryByRef(levelRef)?.level.id ?? null),
    ).toEqual([knownId, 'custom-dual-001']);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    expect(store.getState().bench.diagnostics.lastNotice ?? '').toContain(
      'temporary custom level is now available in Play, Lab, and Bench',
    );
    store.dispose();
  });

  it('accepts dual-field payloads when unused inline entries are malformed', async () => {
    const benchmarkPort = createBenchmarkPortMock();
    const benchmarkStorage = createBenchmarkStorageMock();
    const store = createAppStore({
      solverPort: createNoopSolverPort(),
      benchmarkPort,
      persistencePort: benchmarkStorage,
    });

    const knownId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    const dualFieldPayload = JSON.stringify({
      type: LEVEL_PACK_TYPE,
      version: LEVEL_PACK_VERSION,
      levelIds: [knownId],
      levels: [
        {
          id: 'unused-malformed-level',
          rows: ['WWWWW', 'WPXWW', 'WWWWW'],
        },
      ],
    });

    await expect(
      store.dispatch(importLevelPackSelection(dualFieldPayload)),
    ).resolves.toBeUndefined();

    const importedLevelRefs = store.getState().bench.suite.levelRefs ?? [];
    expect(importedLevelRefs).toHaveLength(1);
    expect(importedLevelRefs[0] ?? '').toMatch(/^temp:/);
    expect(getPlayableEntryByRef(importedLevelRefs[0] ?? '')?.level.id).toBe(knownId);
    expect(store.getState().bench.diagnostics.lastError).toBeNull();
    expect(store.getState().bench.diagnostics.lastNotice).toBeNull();
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
