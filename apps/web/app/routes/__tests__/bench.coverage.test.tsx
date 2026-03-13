// @vitest-environment jsdom

import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BENCHMARK_REPORT_EXPORT_MODEL,
  BENCHMARK_REPORT_TYPE,
  BENCHMARK_REPORT_VERSION,
} from '@corgiban/benchmarks';
import type { LevelDefinition } from '@corgiban/levels';
import { builtinLevels } from '@corgiban/levels';
import type { PlayableEntry } from '../../levels/temporaryLevelCatalog';
import type { ObservedPerformanceEntry } from '../../bench/performanceObserver.client';

const testState = vi.hoisted(() => ({
  benchPageProps: null as null | Record<string, unknown>,
  search: '',
  routeError: null as unknown,
  playableLevels: [] as Array<{
    id: string;
    name: string;
    rows: string[];
    source: 'builtin' | 'temporary';
    knownSolution?: string | null;
  }>,
}));

const fileAccessMocks = vi.hoisted(() => ({
  exportTextFile: vi.fn(),
  importTextFile: vi.fn(),
}));

const performanceMocks = vi.hoisted(() => ({
  clearBenchPerformanceEntries: vi.fn(),
  observeBenchPerformance: vi.fn<[(entries: ObservedPerformanceEntry[]) => void], () => void>(
    () => () => undefined,
  ),
}));

const clientPortMocks = vi.hoisted(() => ({
  createSolverPort: vi.fn(() => ({
    startSolve: vi.fn(async () => {
      throw new Error('solver unavailable');
    }),
    cancelSolve: vi.fn(),
    pingWorker: vi.fn(async () => undefined),
    retryWorker: vi.fn(),
    getWorkerHealth: vi.fn(() => 'idle' as const),
    subscribeWorkerHealth: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  })),
  createBenchmarkPort: vi.fn(() => ({
    runSuite: vi.fn(async () => []),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
  })),
  createPersistencePort: vi.fn(() => ({
    init: vi.fn(async () => ({
      persistOutcome: 'unsupported' as const,
      repositoryHealth: 'durable' as const,
    })),
    loadResults: vi.fn(async () => []),
    saveResult: vi.fn(async () => undefined),
    replaceResults: vi.fn(async () => undefined),
    clearResults: vi.fn(async () => undefined),
    getRepositoryHealth: vi.fn(() => 'durable' as const),
    getLastRepositoryError: vi.fn(() => null),
    dispose: vi.fn(),
  })),
}));

vi.mock('../../bench/BenchPage', () => ({
  BenchPage: (props: Record<string, unknown>) => {
    testState.benchPageProps = props;
    return <div>bench-page-stub</div>;
  },
}));

vi.mock('../../bench/fileAccess.client', () => fileAccessMocks);

vi.mock('../../bench/performanceObserver.client', () => performanceMocks);

function toMockPlayableEntry(level: (typeof testState.playableLevels)[number]): PlayableEntry {
  if (level.source === 'builtin') {
    return {
      ref: `builtin:${level.id}`,
      source: { kind: 'builtin' },
      level: {
        id: level.id,
        name: level.name,
        rows: [...level.rows],
        knownSolution: level.knownSolution ?? null,
      },
    };
  }

  const levelRef = level.id.startsWith('temp:') ? level.id : `temp:${level.id}`;
  return {
    ref: levelRef,
    source: { kind: 'session' },
    level: {
      id: level.id,
      name: level.name,
      rows: [...level.rows],
      knownSolution: level.knownSolution ?? null,
    },
  };
}

vi.mock('../../levels/usePlayableLevels', () => ({
  usePlayableLevels: () => testState.playableLevels.map((level) => toMockPlayableEntry(level)),
  useRequestedPlayableEntryResolution: ({
    levelRef,
    levelId,
    exactLevelKey,
  }: {
    levelRef?: string | null;
    levelId?: string | null;
    exactLevelKey?: string | null;
  }) => {
    const entries = testState.playableLevels.map((level) => toMockPlayableEntry(level));

    if (exactLevelKey === 'pending-client-catalog') {
      return {
        status: 'pendingClientCatalog' as const,
        ...(levelRef ? { requestedRef: levelRef } : {}),
        ...(levelId ? { requestedLevelId: levelId } : {}),
        requestedExactLevelKey: exactLevelKey,
        ...(levelId ? { fallbackLevelId: levelId } : {}),
      };
    }

    if (exactLevelKey === 'missing-exact-key') {
      return {
        status: 'missingExactKey' as const,
        ...(levelRef ? { requestedRef: levelRef } : {}),
        ...(levelId ? { requestedLevelId: levelId } : {}),
        requestedExactLevelKey: exactLevelKey,
        ...(levelId ? { fallbackLevelId: levelId } : {}),
      };
    }

    if (levelRef) {
      const exactEntry = entries.find((entry) => entry.ref === levelRef);
      if (exactEntry) {
        return { status: 'resolved' as const, entry: exactEntry };
      }

      return levelId
        ? {
            status: 'missingExactRef' as const,
            requestedRef: levelRef,
            fallbackLevelId: levelId,
          }
        : {
            status: 'missingExactRef' as const,
            requestedRef: levelRef,
          };
    }

    if (!levelId) {
      return { status: 'none' as const };
    }

    const builtinEntry = entries.find(
      (entry) => entry.source.kind === 'builtin' && entry.level.id === levelId,
    );
    if (builtinEntry) {
      return { status: 'resolved' as const, entry: builtinEntry };
    }

    const sessionEntries = entries.filter(
      (entry) => entry.source.kind === 'session' && entry.level.id === levelId,
    );
    if (sessionEntries.length === 1) {
      return { status: 'resolved' as const, entry: sessionEntries[0] };
    }

    return {
      status: 'missingLevelId' as const,
      requestedLevelId: levelId,
    };
  },
  useResolvedPlayableEntry: ({
    levelRef,
    levelId,
    exactLevelKey,
  }: {
    levelRef?: string | null;
    levelId?: string | null;
    exactLevelKey?: string | null;
  }) => {
    const entries = testState.playableLevels.map((level) => toMockPlayableEntry(level));

    if (exactLevelKey === 'pending-client-catalog' || exactLevelKey === 'missing-exact-key') {
      return null;
    }

    if (levelRef) {
      const exactEntry = entries.find((entry) => entry.ref === levelRef);
      if (exactEntry) {
        return exactEntry;
      }
    }

    if (!levelId) {
      return null;
    }

    const builtinEntry = entries.find(
      (entry) => entry.source.kind === 'builtin' && entry.level.id === levelId,
    );
    if (builtinEntry) {
      return builtinEntry;
    }

    const sessionEntries = entries.filter(
      (entry) => entry.source.kind === 'session' && entry.level.id === levelId,
    );
    return sessionEntries.length === 1 ? sessionEntries[0] : null;
  },
}));

vi.mock('../../levels/temporaryLevelCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../levels/temporaryLevelCatalog')>();
  return {
    ...actual,
    listPlayableEntries: () => testState.playableLevels.map((level) => toMockPlayableEntry(level)),
    getPlayableLevelById: (levelId: string) =>
      testState.playableLevels.find((level) => level.id === levelId) ?? null,
    listPlayableLevels: () => testState.playableLevels,
    upsertTemporaryLevels: (levels: Array<{ id: string; name: string; rows: string[] }>) => {
      const builtinEntries = testState.playableLevels.filter((level) => level.source === 'builtin');
      const temporaryEntries = levels.map((level) => ({
        ...level,
        source: 'temporary' as const,
        knownSolution: null,
      }));
      testState.playableLevels = [...builtinEntries, ...temporaryEntries];
      return temporaryEntries;
    },
  };
});

vi.mock('../../ports/solverPort.client', () => ({
  createSolverPort: clientPortMocks.createSolverPort,
}));

vi.mock('../../ports/benchmarkPort.client', () => ({
  createBenchmarkPort: clientPortMocks.createBenchmarkPort,
}));

vi.mock('../../ports/persistencePort.client', () => ({
  createPersistencePort: clientPortMocks.createPersistencePort,
}));

vi.mock('@remix-run/react', async () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  isRouteErrorResponse: (error: unknown) =>
    typeof error === 'object' && error !== null && 'status' in error && 'statusText' in error,
  useRouteError: () => testState.routeError,
  useSearchParams: () => [new URLSearchParams(testState.search), vi.fn()],
}));

import { createAppStore } from '../../state/store';
import BenchRoute, { BenchRoutePage, ErrorBoundary } from '../bench';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

async function renderWithStore() {
  const store = createAppStore();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <Provider store={store}>
        <BenchRoutePage />
      </Provider>,
    );
  });

  return { container, store };
}

async function renderDefaultRoute() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<BenchRoute />);
  });

  return { container, root };
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function createReportPayload(results: unknown[] = []) {
  return JSON.stringify({
    type: BENCHMARK_REPORT_TYPE,
    version: BENCHMARK_REPORT_VERSION,
    exportModel: BENCHMARK_REPORT_EXPORT_MODEL,
    results,
  });
}

function createLevelPackPayload(
  levelIds: string[],
  levels?: Array<{ id: string; name: string; rows: string[] }>,
) {
  return JSON.stringify({
    type: 'corgiban-level-pack',
    version: 1,
    levelIds,
    ...(levels ? { levels } : {}),
  });
}

describe('BenchRoute coverage', () => {
  const builtinLevel = builtinLevels[0] as LevelDefinition;
  const temporaryLevel = {
    id: 'temporary-bench-level',
    name: 'Temporary Bench Level',
    rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
    source: 'temporary' as const,
    knownSolution: null,
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    testState.benchPageProps = null;
    testState.search = '';
    testState.routeError = null;
    testState.playableLevels = [
      ...builtinLevels.slice(0, 3).map((level) => ({
        ...level,
        source: 'builtin' as const,
        knownSolution: level.knownSolution ?? null,
      })),
      temporaryLevel,
    ];

    fileAccessMocks.exportTextFile.mockReset();
    fileAccessMocks.importTextFile.mockReset();
    performanceMocks.clearBenchPerformanceEntries.mockClear();
    performanceMocks.observeBenchPerformance.mockClear();
    clientPortMocks.createSolverPort.mockClear();
    clientPortMocks.createBenchmarkPort.mockClear();
    clientPortMocks.createPersistencePort.mockClear();
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
    vi.clearAllMocks();
  });

  it('omits builtin suite fallback actions for unavailable session refs whose levelId is not a builtin', () => {
    testState.search = 'levelRef=temp:missing-suite&levelId=temporary-bench-level';

    const html = renderToStaticMarkup(<BenchRoute />);

    expect(html).toContain('Requested suite level is unavailable');
    expect(html).not.toContain('Open Built-In Suite');
  });

  it('ignores missing or unknown handoff level ids and resets the applied ref when the param disappears', async () => {
    const baselineStore = await renderWithStore();
    await flushEffects();
    const baselineLevelIds = baselineStore.store.getState().bench.suite.levelIds;

    testState.search = 'levelId=missing-level';
    const missingStore = await renderWithStore();
    await flushEffects();
    expect(missingStore.store.getState().bench.suite.levelIds).toEqual(baselineLevelIds);

    testState.search = '';
    await flushEffects();
    expect(missingStore.store.getState().bench.suite.levelIds).toEqual(baselineLevelIds);
  });

  it('wires export and import handlers through file access helpers and bench diagnostics', async () => {
    const { store } = await renderWithStore();
    await flushEffects();

    const props = testState.benchPageProps;
    expect(props).not.toBeNull();

    fileAccessMocks.exportTextFile.mockResolvedValueOnce(undefined);
    await act(async () => {
      await (props?.onExportReport as (() => void) | undefined)?.();
    });
    await flushEffects();

    expect(fileAccessMocks.exportTextFile).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: 'corgiban-benchmark-history.json',
      }),
    );
    expect(store.getState().bench.diagnostics.lastNotice).toBe(
      'Benchmark history exported successfully.',
    );

    fileAccessMocks.importTextFile.mockResolvedValueOnce({
      content: createReportPayload(),
    });
    await act(async () => {
      await (props?.onImportReport as (() => void) | undefined)?.();
    });
    await flushEffects();
    expect(fileAccessMocks.importTextFile).toHaveBeenCalledWith({
      acceptMimeTypes: ['application/json'],
    });
    expect(store.getState().bench.diagnostics.lastError).toBeNull();

    fileAccessMocks.importTextFile.mockRejectedValueOnce(new Error('report import failed'));
    await act(async () => {
      await (props?.onImportReport as (() => void) | undefined)?.();
    });
    await flushEffects();
    expect(store.getState().bench.diagnostics.lastError).toBe('report import failed');
  });

  it('exports and imports level packs, clears perf entries, and dispatches suite field callbacks', async () => {
    const { store } = await renderWithStore();
    await flushEffects();

    const props = testState.benchPageProps;
    expect(props).not.toBeNull();
    const initialSuite = store.getState().bench.suite;

    await act(async () => {
      (props?.onToggleLevel as ((levelRef: string) => void) | undefined)?.(
        `builtin:${builtinLevel.id}`,
      );
      (props?.onToggleAlgorithm as ((algorithmId: string) => void) | undefined)?.('bfsPush');
      (props?.onSetRepetitions as ((value: number) => void) | undefined)?.(3);
      (props?.onSetWarmupRepetitions as ((value: number) => void) | undefined)?.(1);
      (props?.onSetTimeBudgetMs as ((value: number) => void) | undefined)?.(1500);
      (props?.onSetNodeBudget as ((value: number) => void) | undefined)?.(7500);
    });

    expect(store.getState().bench.suite).toMatchObject({
      repetitions: 3,
      warmupRepetitions: 1,
      timeBudgetMs: 1500,
      nodeBudget: 7500,
    });
    expect(store.getState().bench.suite.levelIds).not.toEqual(initialSuite.levelIds);
    expect(store.getState().bench.suite.algorithmIds).not.toEqual(initialSuite.algorithmIds);

    fileAccessMocks.exportTextFile.mockResolvedValueOnce(undefined);
    await act(async () => {
      await (props?.onExportLevelPack as (() => void) | undefined)?.();
    });
    await flushEffects();

    expect(fileAccessMocks.exportTextFile).toHaveBeenCalledWith(
      expect.objectContaining({
        suggestedName: 'corgiban-level-pack.json',
      }),
    );
    expect(store.getState().bench.diagnostics.lastNotice).toBe('Level pack exported successfully.');

    fileAccessMocks.importTextFile.mockResolvedValueOnce({
      content: createLevelPackPayload(
        [temporaryLevel.id],
        [
          {
            id: temporaryLevel.id,
            name: temporaryLevel.name,
            rows: temporaryLevel.rows,
          },
        ],
      ),
    });
    await act(async () => {
      await (props?.onImportLevelPack as (() => void) | undefined)?.();
    });
    await flushEffects();
    expect(fileAccessMocks.importTextFile).toHaveBeenCalledWith({
      acceptMimeTypes: ['application/json'],
    });
    expect(store.getState().bench.diagnostics.lastError).toBeNull();

    fileAccessMocks.importTextFile.mockRejectedValueOnce(new Error('level pack import failed'));
    await act(async () => {
      await (props?.onImportLevelPack as (() => void) | undefined)?.();
    });
    await flushEffects();
    expect(store.getState().bench.diagnostics.lastNotice).toBeNull();
    expect(store.getState().bench.diagnostics.lastError).toBe('level pack import failed');

    await act(async () => {
      (props?.onClearPerfEntries as (() => void) | undefined)?.();
    });
    expect(performanceMocks.clearBenchPerformanceEntries).toHaveBeenCalledOnce();
  });

  it('rejects level-pack export when the selected suite includes multiple variants with the same level id', async () => {
    testState.playableLevels = [
      ...builtinLevels.slice(0, 3).map((level) => ({
        ...level,
        source: 'builtin' as const,
        knownSolution: level.knownSolution ?? null,
      })),
      {
        ...builtinLevel,
        name: 'Edited Builtin Variant',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
        source: 'temporary',
        knownSolution: null,
      },
    ];

    const { store } = await renderWithStore();
    await flushEffects();

    const props = testState.benchPageProps;
    expect(props).not.toBeNull();

    await act(async () => {
      (props?.onToggleLevel as ((levelRef: string) => void) | undefined)?.(
        `temp:${builtinLevel.id}`,
      );
    });
    await flushEffects();

    fileAccessMocks.exportTextFile.mockResolvedValueOnce(undefined);
    await act(async () => {
      await (testState.benchPageProps?.onExportLevelPack as (() => void) | undefined)?.();
    });
    await flushEffects();

    expect(fileAccessMocks.exportTextFile).not.toHaveBeenCalled();
    expect(store.getState().bench.diagnostics.lastError).toContain(builtinLevel.id);
  });

  it('handles comparison snapshot export failures and clears results through the route callbacks', async () => {
    const { store } = await renderWithStore();
    await flushEffects();

    const props = testState.benchPageProps;
    expect(props).not.toBeNull();

    fileAccessMocks.exportTextFile.mockRejectedValueOnce(new Error('comparison export failed'));
    await act(async () => {
      await (
        props?.onExportComparisonSnapshot as
          | ((snapshot: Record<string, unknown>) => void)
          | undefined
      )?.({
        type: 'corgiban-benchmark-comparison',
        version: 2,
        comparisonModel: 'strict-suite-input-fingerprint',
      });
    });
    await flushEffects();
    expect(store.getState().bench.diagnostics.lastError).toBe('comparison export failed');

    await act(async () => {
      await (props?.onRun as (() => void) | undefined)?.();
      (props?.onCancel as (() => void) | undefined)?.();
      await (props?.onClearResults as (() => void) | undefined)?.();
    });
    await flushEffects();
  });

  it('records perf entries and uses fallback messages for non-Error export failures', async () => {
    performanceMocks.observeBenchPerformance.mockImplementationOnce(
      (listener: (entries: ObservedPerformanceEntry[]) => void) => {
        listener([
          {
            name: 'bench-effect',
            entryType: 'measure',
            startTime: 1,
            duration: 2,
          },
        ]);
        return () => undefined;
      },
    );

    const { store } = await renderWithStore();
    await flushEffects();

    expect(store.getState().bench.perfEntries).toHaveLength(1);

    const props = testState.benchPageProps;
    expect(props).not.toBeNull();

    fileAccessMocks.exportTextFile.mockRejectedValueOnce('report-export-failure');
    await act(async () => {
      await (props?.onExportReport as (() => void) | undefined)?.();
    });
    await flushEffects();
    expect(store.getState().bench.diagnostics.lastError).toBe('Failed to export report.');

    fileAccessMocks.exportTextFile.mockRejectedValueOnce({ failure: true });
    await act(async () => {
      await (props?.onExportLevelPack as (() => void) | undefined)?.();
    });
    await flushEffects();
    expect(store.getState().bench.diagnostics.lastError).toBe('Failed to export level pack.');

    fileAccessMocks.exportTextFile.mockResolvedValueOnce(undefined);
    await act(async () => {
      await (
        props?.onExportComparisonSnapshot as
          | ((snapshot: Record<string, unknown>) => void)
          | undefined
      )?.({
        type: 'corgiban-benchmark-comparison',
        version: 2,
        comparisonModel: 'strict-suite-input-fingerprint',
      });
    });
    await flushEffects();
    expect(store.getState().bench.diagnostics.lastNotice).toBe(
      'Comparison snapshot exported successfully.',
    );
  });

  it('creates browser-backed ports on mount and restores noop ports on unmount', async () => {
    const { container, root } = await renderDefaultRoute();

    expect(container.textContent).toContain('bench-page-stub');
    expect(clientPortMocks.createSolverPort).toHaveBeenCalledTimes(1);
    expect(clientPortMocks.createBenchmarkPort).toHaveBeenCalledTimes(1);
    expect(clientPortMocks.createPersistencePort).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('renders an unavailable shell instead of BenchPage when the requested entry is missing', async () => {
    testState.search = 'levelRef=temp%3Amissing-session&levelId=temporary-bench-level';

    const { container, root } = await renderDefaultRoute();

    expect(container.textContent).toContain('Requested suite level is unavailable');
    expect(container.textContent).not.toContain('bench-page-stub');
    expect(clientPortMocks.createSolverPort).not.toHaveBeenCalled();
    expect(clientPortMocks.createBenchmarkPort).not.toHaveBeenCalled();
    expect(clientPortMocks.createPersistencePort).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('renders a restore shell instead of BenchPage while the client catalog is still pending', async () => {
    testState.search =
      'levelRef=temp%3Apending-session&levelId=temporary-bench-level&exactLevelKey=pending-client-catalog';

    const { container, root } = await renderDefaultRoute();

    expect(container.textContent).toContain('Restoring suite level');
    expect(container.textContent).not.toContain('Requested suite level is unavailable');
    expect(container.textContent).not.toContain('bench-page-stub');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders an unavailable shell when the requested exact level key no longer matches', async () => {
    const fallbackLevelId = builtinLevels[0]?.id ?? 'corgiban-test-18';
    testState.search = `levelRef=temp%3Amissing-session&levelId=${fallbackLevelId}&exactLevelKey=missing-exact-key`;

    const { container, root } = await renderDefaultRoute();

    expect(container.textContent).toContain('Requested level version is unavailable');
    expect(container.textContent).toContain('Open Built-In Suite');
    expect(container.textContent).not.toContain('bench-page-stub');

    await act(async () => {
      root.unmount();
    });
  });

  it('renders recovery links for route-error responses and generic errors', () => {
    testState.routeError = { status: 503, statusText: 'Service Unavailable' };
    const routeErrorHtml = renderToStaticMarkup(<ErrorBoundary />);
    expect(routeErrorHtml).toContain('503 Service Unavailable');
    expect(routeErrorHtml).toContain('href="/bench"');

    testState.routeError = new Error('Bench exploded');
    const genericErrorHtml = renderToStaticMarkup(<ErrorBoundary />);
    expect(genericErrorHtml).toContain('Bench exploded');
    expect(genericErrorHtml).toContain('href="/"');

    testState.routeError = 'bench-string-error';
    const unknownErrorHtml = renderToStaticMarkup(<ErrorBoundary />);
    expect(unknownErrorHtml).toContain('Unknown error');
  });
});
