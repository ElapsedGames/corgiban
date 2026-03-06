// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BenchmarkAnalyticsPanel } from '../BenchmarkAnalyticsPanel';
import {
  buildComparisonSnapshot,
  buildSuiteLabel,
  buildSuiteComparisons,
  getDefaultBaselineSuiteRunId,
  quantile,
  toSuiteAnalytics,
  type BenchmarkComparisonSnapshot,
  type SuiteAnalytics,
} from '../benchmarkAnalytics';
import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

function createResult(
  suiteRunId: string,
  elapsedMs: number,
  status: BenchmarkRunRecord['status'] = 'unsolved',
  overrides: Partial<BenchmarkRunRecord> = {},
): BenchmarkRunRecord {
  const algorithmId = overrides.algorithmId ?? 'bfsPush';
  const options = overrides.options ?? {
    timeBudgetMs: 1_000,
    nodeBudget: 5_000,
  };
  const environment = overrides.environment ?? {
    userAgent: 'test',
    hardwareConcurrency: 4,
    appVersion: 'test',
  };
  const comparableMetadata = Object.prototype.hasOwnProperty.call(overrides, 'comparableMetadata')
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
      };
  const suffix = `${suiteRunId}-${elapsedMs}-${status}`;

  return {
    id: overrides.id ?? `result-${suffix}`,
    suiteRunId,
    runId: overrides.runId ?? `run-${suffix}`,
    sequence: overrides.sequence ?? elapsedMs,
    levelId: overrides.levelId ?? 'classic-001',
    algorithmId,
    repetition: overrides.repetition ?? 1,
    warmup: overrides.warmup ?? false,
    options,
    status,
    metrics: overrides.metrics ?? {
      elapsedMs,
      expanded: 10,
      generated: 12,
      maxDepth: 4,
      maxFrontier: 6,
      pushCount: 2,
      moveCount: 4,
    },
    startedAtMs: overrides.startedAtMs ?? elapsedMs,
    finishedAtMs: overrides.finishedAtMs ?? elapsedMs + 1,
    solutionMoves: overrides.solutionMoves,
    errorMessage: overrides.errorMessage,
    errorDetails: overrides.errorDetails,
    environment,
    comparableMetadata,
  };
}

function createSuiteAnalytics(overrides: Partial<SuiteAnalytics> = {}): SuiteAnalytics {
  return {
    suiteRunId: overrides.suiteRunId ?? 'suite-a',
    runs: overrides.runs ?? 1,
    solvedRuns: overrides.solvedRuns ?? 1,
    successRate: overrides.successRate ?? 1,
    p50ElapsedMs: overrides.p50ElapsedMs ?? 10,
    p95ElapsedMs: overrides.p95ElapsedMs ?? 10,
    latestFinishedAtMs: overrides.latestFinishedAtMs ?? 11,
    algorithmSummary: overrides.algorithmSummary ?? 'bfsPush',
    suiteLabel: overrides.suiteLabel ?? '1970-01-01T00:00:00.011Z | bfsPush | 1 run | suite-a',
    comparisonFingerprint: Object.prototype.hasOwnProperty.call(overrides, 'comparisonFingerprint')
      ? (overrides.comparisonFingerprint ?? null)
      : 'fp-a',
    comparisonInputs: overrides.comparisonInputs ?? [],
    comparisonIssues: overrides.comparisonIssues ?? [],
  };
}

const mountedRoots: Root[] = [];

async function renderPanel(props: {
  results: BenchmarkRunRecord[];
  onExportSnapshot?: (snapshot: BenchmarkComparisonSnapshot) => void;
}) {
  const container = document.createElement('div');
  document.body.append(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <BenchmarkAnalyticsPanel
        results={props.results}
        onExportSnapshot={props.onExportSnapshot ?? vi.fn()}
      />,
    );
  });

  return {
    container,
    root,
    rerender: async (nextProps: {
      results: BenchmarkRunRecord[];
      onExportSnapshot?: (snapshot: BenchmarkComparisonSnapshot) => void;
    }) => {
      await act(async () => {
        root.render(
          <BenchmarkAnalyticsPanel
            results={nextProps.results}
            onExportSnapshot={nextProps.onExportSnapshot ?? props.onExportSnapshot ?? vi.fn()}
          />,
        );
      });
    },
  };
}

function findButton(container: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes(label),
    ) ?? null
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();

  while (mountedRoots.length > 0) {
    const root = mountedRoots.pop();
    await act(async () => {
      root?.unmount();
    });
  }

  document.body.innerHTML = '';
});

describe('quantile', () => {
  it('returns fallback values for empty, singleton, exact-index, and interpolated inputs', () => {
    expect(quantile([], 0.5)).toBe(0);
    expect(quantile([42], 0.5)).toBe(42);
    expect(quantile([10, 20, 30], 0.5)).toBe(20);
    expect(quantile([10, 20, 30, 40], 0.95)).toBe(38.5);
  });
});

describe('toSuiteAnalytics', () => {
  it('groups by suite, sorts by latest completion time, computes quantiles, and records comparison fingerprints', () => {
    const analytics = toSuiteAnalytics([
      createResult('suite-b', 40, 'solved', { repetition: 2 }),
      createResult('suite-a', 25, 'unsolved'),
      createResult('suite-b', 10, 'solved'),
      createResult('suite-b', 30, 'unsolved', { levelId: 'classic-002', repetition: 1 }),
      createResult('suite-b', 20, 'unsolved', { levelId: 'classic-002', repetition: 2 }),
    ]);

    expect(analytics).toHaveLength(2);
    expect(analytics[0]).toEqual(
      expect.objectContaining({
        suiteRunId: 'suite-b',
        runs: 4,
        solvedRuns: 2,
        successRate: 0.5,
        p50ElapsedMs: 25,
        p95ElapsedMs: 38.5,
        latestFinishedAtMs: 41,
        algorithmSummary: 'bfsPush',
        suiteLabel: expect.stringContaining('suite-b'),
        comparisonIssues: [],
      }),
    );
    expect(analytics[0]?.comparisonFingerprint).toBeTruthy();
    expect(analytics[0]?.comparisonInputs).toHaveLength(4);
    expect(analytics[1]).toEqual(
      expect.objectContaining({
        suiteRunId: 'suite-a',
        runs: 1,
        solvedRuns: 0,
        successRate: 0,
        p50ElapsedMs: 25,
        p95ElapsedMs: 25,
        latestFinishedAtMs: 26,
        algorithmSummary: 'bfsPush',
        suiteLabel: expect.stringContaining('suite-a'),
        comparisonInputs: [
          {
            levelId: 'classic-001',
            repetition: 1,
            solver: {
              algorithmId: 'bfsPush',
              timeBudgetMs: 1_000,
              nodeBudget: 5_000,
            },
            environment: {
              userAgent: 'test',
              hardwareConcurrency: 4,
              appVersion: 'test',
            },
            warmupEnabled: false,
            warmupRepetitions: 0,
          },
        ],
        comparisonIssues: [],
      }),
    );
    expect(analytics[1]?.comparisonFingerprint).toBeTruthy();
  });

  it('prefers the most recent comparable suite as the default baseline', () => {
    const analytics = toSuiteAnalytics([
      createResult('suite-a', 10, 'unsolved', { comparableMetadata: undefined }),
      createResult('suite-b', 20, 'solved'),
    ]);

    expect(getDefaultBaselineSuiteRunId(analytics)).toBe('suite-b');
  });

  it('breaks timestamp ties by suite id and summarizes mixed algorithms with plural run labels', () => {
    const analytics = toSuiteAnalytics([
      createResult('suite-b', 20, 'solved', {
        algorithmId: 'bfsPush',
        finishedAtMs: 101,
      }),
      createResult('suite-a', 10, 'solved', {
        finishedAtMs: 101,
      }),
      createResult('suite-b', 30, 'solved', {
        algorithmId: 'astarPush',
        finishedAtMs: 101,
      }),
    ]);

    expect(analytics.map((suite) => suite.suiteRunId)).toEqual(['suite-a', 'suite-b']);
    expect(analytics[1]).toEqual(
      expect.objectContaining({
        algorithmSummary: 'astarPush +1 more',
        suiteLabel: '1970-01-01T00:00:00.101Z | astarPush +1 more | 2 runs | suite-b',
      }),
    );
  });
});

describe('buildSuiteLabel', () => {
  it('formats timestamps and singular/plural run counts in the label', () => {
    expect(
      buildSuiteLabel({
        latestFinishedAtMs: 11,
        algorithmSummary: 'bfsPush',
        runs: 1,
        suiteRunId: 'suite-one',
      }),
    ).toBe('1970-01-01T00:00:00.011Z | bfsPush | 1 run | suite-one');
    expect(
      buildSuiteLabel({
        latestFinishedAtMs: 101,
        algorithmSummary: 'astarPush +1 more',
        runs: 2,
        suiteRunId: 'suite-two',
      }),
    ).toBe('1970-01-01T00:00:00.101Z | astarPush +1 more | 2 runs | suite-two');
  });
});

describe('getDefaultBaselineSuiteRunId', () => {
  it('falls back to the first suite when none are comparable', () => {
    expect(
      getDefaultBaselineSuiteRunId([
        createSuiteAnalytics({ suiteRunId: 'suite-first', comparisonFingerprint: null }),
        createSuiteAnalytics({ suiteRunId: 'suite-second', comparisonFingerprint: null }),
      ]),
    ).toBe('suite-first');
  });

  it('returns an empty string when there are no suites', () => {
    expect(getDefaultBaselineSuiteRunId([])).toBe('');
  });
});

describe('buildSuiteComparisons', () => {
  it('marks suites as non-comparable when the selected baseline is unavailable', () => {
    expect(buildSuiteComparisons([createSuiteAnalytics()], null)).toEqual([
      {
        suiteRunId: 'suite-a',
        comparable: false,
        reason: 'Selected baseline suite is unavailable.',
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      },
    ]);
  });

  it('prefers the baseline issue when the selected baseline lacks comparable metadata', () => {
    const baseline = createSuiteAnalytics({
      suiteRunId: 'suite-baseline',
      comparisonFingerprint: null,
      comparisonIssues: ['Baseline metadata missing.'],
    });
    const suite = createSuiteAnalytics({ suiteRunId: 'suite-compare' });

    expect(buildSuiteComparisons([suite], baseline)).toEqual([
      {
        suiteRunId: 'suite-compare',
        comparable: false,
        reason: 'Baseline metadata missing.',
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      },
    ]);
  });

  it('uses the baseline fallback reason when comparable metadata is missing without audit issues', () => {
    const baseline = createSuiteAnalytics({
      suiteRunId: 'suite-baseline',
      comparisonFingerprint: null,
      comparisonIssues: [],
    });
    const suite = createSuiteAnalytics({ suiteRunId: 'suite-compare' });

    expect(buildSuiteComparisons([suite], baseline)).toEqual([
      {
        suiteRunId: 'suite-compare',
        comparable: false,
        reason: 'Selected baseline suite lacks comparable metadata.',
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      },
    ]);
  });

  it('prefers the suite audit issue when the compared suite lacks comparable metadata', () => {
    const baseline = createSuiteAnalytics({
      suiteRunId: 'suite-baseline',
      comparisonFingerprint: 'fp-shared',
    });
    const suite = createSuiteAnalytics({
      suiteRunId: 'suite-missing',
      comparisonFingerprint: null,
      comparisonIssues: ['Suite metadata missing.'],
    });

    expect(buildSuiteComparisons([suite], baseline)).toEqual([
      {
        suiteRunId: 'suite-missing',
        comparable: false,
        reason: 'Suite metadata missing.',
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      },
    ]);
  });

  it('uses the suite fallback reason when audit issues are unavailable', () => {
    const baseline = createSuiteAnalytics({
      suiteRunId: 'suite-baseline',
      comparisonFingerprint: 'fp-shared',
    });
    const suite = createSuiteAnalytics({
      suiteRunId: 'suite-missing',
      comparisonFingerprint: null,
      comparisonIssues: [],
    });

    expect(buildSuiteComparisons([suite], baseline)).toEqual([
      {
        suiteRunId: 'suite-missing',
        comparable: false,
        reason: 'Suite lacks comparable metadata required for comparison.',
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      },
    ]);
  });
});

describe('buildComparisonSnapshot', () => {
  it('requires a comparable baseline and retains suite audit metadata', () => {
    const suites: SuiteAnalytics[] = [
      createSuiteAnalytics({
        comparisonInputs: [
          {
            levelId: 'classic-001',
            repetition: 1,
            solver: { algorithmId: 'bfsPush', timeBudgetMs: 1_000, nodeBudget: 5_000 },
            environment: {
              userAgent: 'test',
              hardwareConcurrency: 4,
              appVersion: 'test',
            },
            warmupEnabled: false,
            warmupRepetitions: 0,
          },
        ],
      }),
    ];
    const comparisons = buildSuiteComparisons(suites, suites[0] ?? null);

    expect(
      buildComparisonSnapshot(null, suites, comparisons, '2026-03-05T18:00:00.000Z'),
    ).toBeNull();
    expect(
      buildComparisonSnapshot(
        {
          ...suites[0]!,
          comparisonFingerprint: null,
          comparisonIssues: ['Missing comparable metadata for run run-1.'],
        },
        suites,
        comparisons,
        '2026-03-05T18:00:00.000Z',
      ),
    ).toBeNull();
    expect(
      buildComparisonSnapshot(suites[0] ?? null, suites, comparisons, '2026-03-05T18:00:00.000Z'),
    ).toEqual({
      type: 'corgiban-benchmark-comparison',
      version: 2,
      comparisonModel: 'strict-suite-input-fingerprint',
      baselineSuiteRunId: 'suite-a',
      generatedAtIso: '2026-03-05T18:00:00.000Z',
      suites,
      comparisons,
    });
  });
});

describe('BenchmarkAnalyticsPanel', () => {
  it('renders the empty state and keeps export disabled without results', async () => {
    const onExportSnapshot = vi.fn();
    const { container } = await renderPanel({
      results: [],
      onExportSnapshot,
    });

    expect(container.textContent).toContain('Run at least one suite to generate analytics.');

    const exportButton = findButton(container, 'Export comparison snapshot');
    expect(exportButton).not.toBeNull();
    expect(exportButton?.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      exportButton?.click();
    });

    expect(onExportSnapshot).not.toHaveBeenCalled();
  });

  it('exports comparable suites using the most recent comparable suite as the default baseline', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-05T18:00:00.000Z'));

    const onExportSnapshot = vi.fn();
    const { container } = await renderPanel({
      results: [createResult('suite-a', 25, 'unsolved'), createResult('suite-b', 40, 'solved')],
      onExportSnapshot,
    });

    const select = container.querySelector('select');
    expect(select?.value).toBe('');
    expect(select?.textContent).toContain('suite-b');
    expect(container.textContent).toContain('Comparable');
    expect(container.textContent).not.toContain('Not comparable');

    const exportButton = findButton(container, 'Export comparison snapshot');
    expect(exportButton?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      exportButton?.click();
    });

    expect(onExportSnapshot).toHaveBeenCalledTimes(1);
    expect(onExportSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'corgiban-benchmark-comparison',
        version: 2,
        comparisonModel: 'strict-suite-input-fingerprint',
        baselineSuiteRunId: 'suite-b',
        generatedAtIso: '2026-03-05T18:00:00.000Z',
        comparisons: [
          {
            suiteRunId: 'suite-b',
            comparable: true,
            reason: null,
            deltaSuccessRate: 0,
            deltaP50ElapsedMs: 0,
            deltaP95ElapsedMs: 0,
          },
          {
            suiteRunId: 'suite-a',
            comparable: true,
            reason: null,
            deltaSuccessRate: -1,
            deltaP50ElapsedMs: -15,
            deltaP95ElapsedMs: -15,
          },
        ],
      }),
    );
    expect(onExportSnapshot.mock.calls[0]?.[0].suites[0]?.comparisonFingerprint).toBeTruthy();
    expect(onExportSnapshot.mock.calls[0]?.[0].suites[1]?.comparisonInputs).toHaveLength(1);
  });

  it('updates the baseline when the user selects a different comparable suite', async () => {
    const onExportSnapshot = vi.fn();
    const { container } = await renderPanel({
      results: [createResult('suite-a', 10, 'unsolved'), createResult('suite-b', 20, 'solved')],
      onExportSnapshot,
    });

    const select = container.querySelector('select');
    expect(select).not.toBeNull();

    await act(async () => {
      if (!select) {
        return;
      }
      select.value = 'suite-b';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(select?.value).toBe('suite-b');
    expect(container.textContent).toContain('Baseline');
    expect(container.textContent).toContain('-100.0%');
    expect(container.textContent).toContain('-10.0');

    await act(async () => {
      findButton(container, 'Export comparison snapshot')?.click();
    });

    expect(onExportSnapshot).toHaveBeenCalledTimes(1);
    expect(onExportSnapshot.mock.calls[0]?.[0].baselineSuiteRunId).toBe('suite-b');
  });

  it('marks mismatched suites as not comparable and exports the audit reason', async () => {
    const onExportSnapshot = vi.fn();
    const { container } = await renderPanel({
      results: [
        createResult('suite-a', 10, 'solved'),
        createResult('suite-b', 20, 'solved', {
          options: {
            timeBudgetMs: 1_000,
            nodeBudget: 7_500,
          },
        }),
      ],
      onExportSnapshot,
    });

    expect(container.textContent).toContain('Not comparable');
    expect(container.textContent).toContain('Non-comparable suites: suite-a');
    expect(container.textContent).toContain('n/a');

    await act(async () => {
      findButton(container, 'Export comparison snapshot')?.click();
    });

    expect(onExportSnapshot).toHaveBeenCalledTimes(1);
    expect(onExportSnapshot.mock.calls[0]?.[0].comparisons).toEqual([
      {
        suiteRunId: 'suite-b',
        comparable: true,
        reason: null,
        deltaSuccessRate: 0,
        deltaP50ElapsedMs: 0,
        deltaP95ElapsedMs: 0,
      },
      {
        suiteRunId: 'suite-a',
        comparable: false,
        reason: 'Suite inputs or comparable metadata differ from the selected baseline.',
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      },
    ]);
  });

  it('resets a stale selected baseline back to auto when results change', async () => {
    const onExportSnapshot = vi.fn();
    const { container, rerender } = await renderPanel({
      results: [createResult('suite-a', 10, 'unsolved'), createResult('suite-b', 20, 'solved')],
      onExportSnapshot,
    });

    const select = container.querySelector('select');
    expect(select).not.toBeNull();

    await act(async () => {
      if (!select) {
        return;
      }
      select.value = 'suite-a';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(select?.value).toBe('suite-a');

    await rerender({
      results: [createResult('suite-b', 20, 'solved')],
      onExportSnapshot,
    });

    const updatedSelect = container.querySelector('select');
    expect(updatedSelect?.value).toBe('');

    const exportButton = findButton(container, 'Export comparison snapshot');
    expect(exportButton?.hasAttribute('disabled')).toBe(false);
    expect(container.textContent).toContain('suite-b');

    await act(async () => {
      exportButton?.click();
    });

    expect(onExportSnapshot).toHaveBeenCalledTimes(1);
    expect(onExportSnapshot.mock.calls[0]?.[0].baselineSuiteRunId).toBe('suite-b');
  });
});
