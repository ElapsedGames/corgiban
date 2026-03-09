import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { BenchmarkRunRecord } from '../../ports/benchmarkPort';
import {
  BenchmarkResultsTable,
  compareBenchmarkValues,
  formatBenchmarkTimestamp,
  getNextSortState,
  sortBenchmarkResults,
} from '../BenchmarkResultsTable';

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'bench-1',
    runId: 'bench-1-1',
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

describe('BenchmarkResultsTable', () => {
  it('renders empty state when no results are present', () => {
    const html = renderToStaticMarkup(<BenchmarkResultsTable results={[]} />);

    expect(html).toContain('No benchmark results yet.');
    expect(html).toContain('Stored benchmark history (0 runs)');
  });

  it('renders rows sorted by completed timestamp descending by default', () => {
    const oldest = createResult({
      id: 'oldest',
      suiteRunId: 'suite-oldest',
      levelId: 'level-oldest',
      finishedAtMs: 1000,
      startedAtMs: 900,
    });
    const newest = createResult({
      id: 'newest',
      suiteRunId: 'suite-newest',
      levelId: 'level-newest',
      finishedAtMs: 4000,
      startedAtMs: 3900,
    });
    const middle = createResult({
      id: 'middle',
      suiteRunId: 'suite-middle',
      levelId: 'level-middle',
      finishedAtMs: 2500,
      startedAtMs: 2400,
    });

    const html = renderToStaticMarkup(<BenchmarkResultsTable results={[oldest, newest, middle]} />);

    expect(html.indexOf('level-newest')).toBeLessThan(html.indexOf('level-middle'));
    expect(html.indexOf('level-middle')).toBeLessThan(html.indexOf('level-oldest'));
    expect(html).toContain('suite-newest');
  });

  it('renders metrics and status columns for each result', () => {
    const html = renderToStaticMarkup(
      <BenchmarkResultsTable
        results={[
          createResult({
            id: 'metrics-row',
            status: 'solved',
            metrics: {
              elapsedMs: 123,
              expanded: 456,
              generated: 789,
              maxDepth: 1,
              maxFrontier: 2,
              pushCount: 3,
              moveCount: 4,
            },
          }),
        ]}
      />,
    );

    expect(html).toContain('123');
    expect(html).toContain('456');
    expect(html).toContain('789');
    expect(html).toContain('solved');
  });

  it('sorts results deterministically across sortable keys', () => {
    const alpha = createResult({
      id: 'alpha',
      levelId: 'alpha-level',
      algorithmId: 'astarPush',
      status: 'solved',
      finishedAtMs: 100,
      metrics: {
        ...createResult().metrics,
        elapsedMs: 50,
      },
    });
    const beta = createResult({
      id: 'beta',
      levelId: 'beta-level',
      algorithmId: 'bfsPush',
      status: 'timeout',
      finishedAtMs: 200,
      metrics: {
        ...createResult().metrics,
        elapsedMs: 5,
      },
    });

    expect(
      sortBenchmarkResults([beta, alpha], 'levelId', 'asc').map((result) => result.id),
    ).toEqual(['alpha', 'beta']);
    expect(
      sortBenchmarkResults([alpha, beta], 'algorithmId', 'desc').map((result) => result.id),
    ).toEqual(['beta', 'alpha']);
    expect(
      sortBenchmarkResults(
        [
          { ...alpha, suiteRunId: 'suite-b' },
          { ...beta, suiteRunId: 'suite-a' },
        ],
        'suiteRunId',
        'asc',
      ).map((result) => result.suiteRunId),
    ).toEqual(['suite-a', 'suite-b']);
    expect(sortBenchmarkResults([alpha, beta], 'status', 'asc').map((result) => result.id)).toEqual(
      ['alpha', 'beta'],
    );
    expect(
      sortBenchmarkResults([alpha, beta], 'elapsedMs', 'asc').map((result) => result.id),
    ).toEqual(['beta', 'alpha']);
    expect(
      sortBenchmarkResults([alpha, beta], 'finishedAtMs', 'desc').map((result) => result.id),
    ).toEqual(['beta', 'alpha']);
  });

  it('computes next sort-state transitions for repeat and new keys', () => {
    expect(getNextSortState('levelId', 'asc', 'levelId')).toEqual({
      sortKey: 'levelId',
      direction: 'desc',
    });
    expect(getNextSortState('levelId', 'desc', 'levelId')).toEqual({
      sortKey: 'levelId',
      direction: 'asc',
    });
    expect(getNextSortState('status', 'asc', 'finishedAtMs')).toEqual({
      sortKey: 'finishedAtMs',
      direction: 'desc',
    });
    expect(getNextSortState('finishedAtMs', 'desc', 'algorithmId')).toEqual({
      sortKey: 'algorithmId',
      direction: 'asc',
    });
  });

  it('renders an sr-only caption with row count when results are present', () => {
    const html = renderToStaticMarkup(
      <BenchmarkResultsTable results={[createResult(), createResult({ id: 'result-2' })]} />,
    );

    expect(html).toContain('Benchmark run results');
    expect(html).toContain('2 rows');
    expect(html).toContain('Click column headers to sort');
  });

  it('compares primitive values and formats timestamps', () => {
    expect(compareBenchmarkValues('a', 'b')).toBeLessThan(0);
    expect(compareBenchmarkValues('z', 'a')).toBeGreaterThan(0);
    expect(compareBenchmarkValues(10, 10)).toBe(0);

    const formatted = formatBenchmarkTimestamp(0);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(0);
  });
});
