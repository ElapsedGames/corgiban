import { useId, useMemo, useState } from 'react';

import type { BenchmarkRunRecord } from '../ports/benchmarkPort';

export type SortKey =
  | 'finishedAtMs'
  | 'suiteRunId'
  | 'algorithmId'
  | 'levelId'
  | 'status'
  | 'elapsedMs';

export type SortDirection = 'asc' | 'desc';

export type BenchmarkResultsTableProps = {
  results: BenchmarkRunRecord[];
};

export function compareBenchmarkValues(left: string | number, right: string | number): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function getSortValue(result: BenchmarkRunRecord, sortKey: SortKey): string | number {
  return sortKey === 'elapsedMs'
    ? result.metrics.elapsedMs
    : sortKey === 'finishedAtMs'
      ? result.finishedAtMs
      : result[sortKey];
}

export function sortBenchmarkResults(
  results: BenchmarkRunRecord[],
  sortKey: SortKey,
  direction: SortDirection,
): BenchmarkRunRecord[] {
  const factor = direction === 'asc' ? 1 : -1;

  return [...results].sort((left, right) => {
    return (
      compareBenchmarkValues(getSortValue(left, sortKey), getSortValue(right, sortKey)) * factor
    );
  });
}

export function formatBenchmarkTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString();
}

export function getNextSortState(
  currentKey: SortKey,
  currentDirection: SortDirection,
  nextKey: SortKey,
): { sortKey: SortKey; direction: SortDirection } {
  if (nextKey === currentKey) {
    return {
      sortKey: currentKey,
      direction: currentDirection === 'asc' ? 'desc' : 'asc',
    };
  }

  return {
    sortKey: nextKey,
    direction: nextKey === 'finishedAtMs' ? 'desc' : 'asc',
  };
}

export function BenchmarkResultsTable({ results }: BenchmarkResultsTableProps) {
  const headingId = useId();
  const [sortKey, setSortKey] = useState<SortKey>('finishedAtMs');
  const [direction, setDirection] = useState<SortDirection>('desc');

  const sortedResults = useMemo(
    () => sortBenchmarkResults(results, sortKey, direction),
    [direction, results, sortKey],
  );

  const setSort = (nextKey: SortKey) => {
    const nextState = getNextSortState(sortKey, direction, nextKey);
    setSortKey(nextState.sortKey);
    setDirection(nextState.direction);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span aria-hidden="true">{direction === 'asc' ? ' ^' : ' v'}</span>;
  };

  const thSortButtonClasses =
    'cursor-pointer rounded-sm px-1 py-0.5 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            Results
          </h2>
          <p className="text-sm text-muted">
            Stored benchmark history ({results.length} runs). Click column labels to sort.
          </p>
        </div>
      </div>

      {sortedResults.length === 0 ? (
        <p className="rounded-app-md border border-dashed border-border px-3 py-4 text-sm text-muted">
          No benchmark results yet.
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <caption className="sr-only">
              Benchmark run results, {results.length} {results.length === 1 ? 'row' : 'rows'}. Click
              column headers to sort.
            </caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th
                  scope="col"
                  className="px-2 py-2"
                  aria-sort={
                    sortKey === 'finishedAtMs'
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={thSortButtonClasses}
                    onClick={() => setSort('finishedAtMs')}
                  >
                    Completed{sortIndicator('finishedAtMs')}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-2 py-2"
                  aria-sort={
                    sortKey === 'suiteRunId'
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={thSortButtonClasses}
                    onClick={() => setSort('suiteRunId')}
                  >
                    Suite{sortIndicator('suiteRunId')}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-2 py-2"
                  aria-sort={
                    sortKey === 'levelId'
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={thSortButtonClasses}
                    onClick={() => setSort('levelId')}
                  >
                    Level{sortIndicator('levelId')}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-2 py-2"
                  aria-sort={
                    sortKey === 'algorithmId'
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={thSortButtonClasses}
                    onClick={() => setSort('algorithmId')}
                  >
                    Algorithm{sortIndicator('algorithmId')}
                  </button>
                </th>
                <th
                  scope="col"
                  className="px-2 py-2 text-right"
                  aria-sort={
                    sortKey === 'elapsedMs'
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={thSortButtonClasses}
                    onClick={() => setSort('elapsedMs')}
                  >
                    Elapsed (<abbr title="milliseconds">ms</abbr>){sortIndicator('elapsedMs')}
                  </button>
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Expanded
                </th>
                <th scope="col" className="px-2 py-2 text-right">
                  Generated
                </th>
                <th
                  scope="col"
                  className="px-2 py-2"
                  aria-sort={
                    sortKey === 'status'
                      ? direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    className={thSortButtonClasses}
                    onClick={() => setSort('status')}
                  >
                    Status{sortIndicator('status')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result) => (
                <tr key={result.id} className="border-b border-border/60">
                  <td className="px-2 py-2">{formatBenchmarkTimestamp(result.finishedAtMs)}</td>
                  <td className="px-2 py-2">{result.suiteRunId}</td>
                  <td className="px-2 py-2" data-testid="benchmark-result-level">
                    {result.levelId}
                  </td>
                  <td className="px-2 py-2">{result.algorithmId}</td>
                  <td className="px-2 py-2 text-right">
                    {result.metrics.elapsedMs.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {result.metrics.expanded.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {result.metrics.generated.toLocaleString()}
                  </td>
                  <td className="px-2 py-2">{result.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
