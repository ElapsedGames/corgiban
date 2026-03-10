import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';
import type { BenchPerfEntry } from '../../state/benchSlice';
import { BenchPage } from '../BenchPage';
import { exportTextFile, importTextFile } from '../fileAccess.client';
import { observeBenchPerformance } from '../performanceObserver.client';
import type { PerformanceObserverApis } from '../performanceObserver.client';
import { BenchDiagnosticsPanel } from '../BenchDiagnosticsPanel';
import { BenchmarkExportImportControls } from '../BenchmarkExportImportControls';
import { BenchmarkPerfPanel } from '../BenchmarkPerfPanel';
import { BenchmarkResultsTable } from '../BenchmarkResultsTable';
import { BenchmarkSuiteBuilder } from '../BenchmarkSuiteBuilder';

function findByType(node: unknown, targetType: unknown): ReactElement | undefined {
  if (!node) {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findByType(child, targetType);
      if (match) {
        return match;
      }
    }
    return undefined;
  }
  if (!isValidElement<{ children?: unknown }>(node)) {
    return undefined;
  }
  if (node.type === targetType) {
    return node;
  }
  return findByType(node.props?.children, targetType);
}

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

const noop = () => undefined;

const baseProps = {
  suite: {
    levelIds: ['corgiban-test-18'],
    algorithmIds: ['bfsPush' as const],
    repetitions: 1,
    timeBudgetMs: 1000,
    nodeBudget: 500,
  },
  status: 'idle' as const,
  progress: {
    totalRuns: 0,
    completedRuns: 0,
    latestResultId: null,
  },
  results: [createResult()],
  diagnostics: {
    persistOutcome: 'granted' as const,
    repositoryHealth: 'durable' as const,
    lastError: null,
    lastNotice: null,
  },
  perfEntries: [
    {
      name: 'bench:solve-roundtrip:bench-1-1',
      entryType: 'measure',
      startTime: 1,
      duration: 2,
    } satisfies BenchPerfEntry,
  ],
  debug: false,
  availableLevels: [{ id: 'corgiban-test-18', name: 'Classic 001' }],
  availableAlgorithms: [{ id: 'bfsPush' as const, label: 'bfsPush' }],
  onToggleLevel: noop,
  onToggleAlgorithm: noop,
  onSetRepetitions: noop,
  onSetTimeBudgetMs: noop,
  onSetNodeBudget: noop,
  onRun: noop,
  onCancel: noop,
  onClearPerfEntries: noop,
  onExportReport: noop,
  onImportReport: noop,
  onExportLevelPack: noop,
  onImportLevelPack: noop,
  onClearResults: noop,
};

describe('BenchPage', () => {
  it('renders bench sections and child components into static markup', () => {
    const html = renderToStaticMarkup(
      <BenchPage
        {...baseProps}
        debug
        onRun={noop}
        onCancel={noop}
        onToggleLevel={noop}
        onToggleAlgorithm={noop}
        onSetRepetitions={noop}
        onSetTimeBudgetMs={noop}
        onSetNodeBudget={noop}
      />,
    );

    expect(html).toContain('Suite Builder');
    expect(html).toContain('Results');
    expect(html).toContain('Diagnostics');
    expect(html).toContain(
      'Run solver benchmarks across multiple levels and review execution outcomes separately from persistence durability.',
    );
    expect(html).toContain('Import / Export');
    expect(html).toContain('Performance');
  });

  it('composes the bench sections and hides perf panel when debug is disabled', () => {
    const element = BenchPage(baseProps);

    expect(findByType(element, BenchmarkSuiteBuilder)).toBeDefined();
    expect(findByType(element, BenchmarkResultsTable)).toBeDefined();
    expect(findByType(element, BenchDiagnosticsPanel)).toBeDefined();
    expect(findByType(element, BenchmarkExportImportControls)).toBeDefined();
    expect(findByType(element, BenchmarkPerfPanel)).toBeUndefined();
  });

  it('shows perf panel when debug is enabled', () => {
    const element = BenchPage({
      ...baseProps,
      debug: true,
    });

    const perfPanel = findByType(element, BenchmarkPerfPanel);
    expect(perfPanel).toBeDefined();
    expect(perfPanel?.props.entries).toHaveLength(1);
  });

  it('wires suite builder callbacks from page props', () => {
    const runCalls: string[] = [];
    const cancelCalls: string[] = [];

    const element = BenchPage({
      ...baseProps,
      onRun: () => {
        runCalls.push('run');
      },
      onCancel: () => {
        cancelCalls.push('cancel');
      },
    });

    const builder = findByType(element, BenchmarkSuiteBuilder);
    expect(builder).toBeDefined();

    builder?.props.onRun();
    builder?.props.onCancel();

    expect(runCalls).toEqual(['run']);
    expect(cancelCalls).toEqual(['cancel']);
  });

  it('supports file picker and fallback import/export paths', async () => {
    const writable = {
      write: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const methodA = await exportTextFile(
      {
        suggestedName: 'report.json',
        content: '{"ok":true}',
      },
      {
        showSaveFilePicker: vi.fn(async () => ({
          createWritable: async () => writable,
        })),
      },
    );
    expect(methodA).toBe('file-system-access');
    expect(writable.write).toHaveBeenCalled();
    expect(writable.close).toHaveBeenCalled();

    const click = vi.fn();
    const methodB = await exportTextFile(
      {
        suggestedName: 'report.json',
        content: '{"ok":true}',
      },
      {
        createBlob: (parts, options) => new Blob(parts, options),
        createObjectUrl: () => 'blob:test',
        revokeObjectUrl: vi.fn(),
        createAnchor: () =>
          ({
            href: '',
            download: '',
            click,
          }) as { href: string; download: string; click: () => void },
      },
    );
    expect(methodB).toBe('anchor-download');
    expect(click).toHaveBeenCalled();

    const importedA = await importTextFile(
      {},
      {
        showOpenFilePicker: vi.fn(async () => [
          {
            getFile: async () => ({
              text: async () => '{\"kind\":\"picker\"}',
            }),
          },
        ]),
      },
    );
    expect(importedA).toEqual({ content: '{"kind":"picker"}', method: 'file-system-access' });

    const importedB = await importTextFile(
      {},
      {
        openTextWithInput: vi.fn(async () => '{"kind":"input"}'),
      },
    );
    expect(importedB).toEqual({ content: '{"kind":"input"}', method: 'file-input' });
  });

  it('disables imports when status is running', () => {
    const element = BenchPage({
      ...baseProps,
      status: 'running',
    });

    const controls = findByType(element, BenchmarkExportImportControls);
    expect(controls).toBeDefined();
    expect(controls?.props.disableImports).toBe(true);
    expect(controls?.props.disableClear).toBe(true);
  });

  it('disables imports when status is cancelling', () => {
    const element = BenchPage({
      ...baseProps,
      status: 'cancelling',
    });

    const controls = findByType(element, BenchmarkExportImportControls);
    expect(controls).toBeDefined();
    expect(controls?.props.disableImports).toBe(true);
    expect(controls?.props.disableClear).toBe(true);
  });

  it('disables export report when no results but enables export level pack when levels selected', () => {
    const element = BenchPage({
      ...baseProps,
      results: [],
      suite: { ...baseProps.suite, levelIds: ['corgiban-test-18'] },
    });

    const controls = findByType(element, BenchmarkExportImportControls);
    expect(controls).toBeDefined();
    expect(controls?.props.disableExportReport).toBe(true);
    expect(controls?.props.disableExportLevelPack).toBe(false);
  });

  it('disables export level pack when no levels but enables export report when results exist', () => {
    const element = BenchPage({
      ...baseProps,
      results: [createResult()],
      suite: { ...baseProps.suite, levelIds: [] },
    });

    const controls = findByType(element, BenchmarkExportImportControls);
    expect(controls).toBeDefined();
    expect(controls?.props.disableExportReport).toBe(false);
    expect(controls?.props.disableExportLevelPack).toBe(true);
  });

  it('filters observed performance entries to bench measures', () => {
    const disconnect = vi.fn();

    class FakePerformanceObserver {
      readonly callback: (entryList: { getEntries: () => PerformanceEntry[] }) => void;

      constructor(callback: (entryList: { getEntries: () => PerformanceEntry[] }) => void) {
        this.callback = callback;
      }

      observe() {
        this.callback({
          getEntries: () =>
            [
              {
                name: 'bench:solve-roundtrip:run-1',
                entryType: 'measure',
                startTime: 1,
                duration: 3,
              },
              {
                name: 'other:metric',
                entryType: 'measure',
                startTime: 1,
                duration: 3,
              },
            ] as PerformanceEntry[],
        });
      }

      disconnect() {
        disconnect();
      }
    }

    const observed: Array<{ name: string }> = [];
    const stop = observeBenchPerformance(
      (entries) => {
        observed.push(...entries);
      },
      {
        PerformanceObserverImpl: FakePerformanceObserver as unknown as NonNullable<
          PerformanceObserverApis['PerformanceObserverImpl']
        >,
      },
    );

    expect(observed).toHaveLength(1);
    expect(observed[0]?.name).toBe('bench:solve-roundtrip:run-1');

    stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
