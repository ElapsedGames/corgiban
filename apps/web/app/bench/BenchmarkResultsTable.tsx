import { useMemo, useState } from 'react';

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

  return (
    <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Results</h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Stored benchmark history ({results.length} runs). Click column labels to sort.
          </p>
        </div>
      </div>

      {sortedResults.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] px-3 py-4 text-sm text-[color:var(--color-muted)]">
          No benchmark results yet.
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--color-border)] text-left text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
                <th className="px-2 py-2">
                  <button type="button" onClick={() => setSort('finishedAtMs')}>
                    Completed
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => setSort('suiteRunId')}>
                    Suite
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => setSort('levelId')}>
                    Level
                  </button>
                </th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => setSort('algorithmId')}>
                    Algorithm
                  </button>
                </th>
                <th className="px-2 py-2 text-right">
                  <button type="button" onClick={() => setSort('elapsedMs')}>
                    Elapsed (ms)
                  </button>
                </th>
                <th className="px-2 py-2 text-right">Expanded</th>
                <th className="px-2 py-2 text-right">Generated</th>
                <th className="px-2 py-2">
                  <button type="button" onClick={() => setSort('status')}>
                    Status
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedResults.map((result) => (
                <tr key={result.id} className="border-b border-[color:var(--color-border)]/60">
                  <td className="px-2 py-2">{formatBenchmarkTimestamp(result.finishedAtMs)}</td>
                  <td className="px-2 py-2">{result.suiteRunId}</td>
                  <td className="px-2 py-2" data-testid="benchmark-result-level">
                    {result.levelId}
                  </td>
                  <td className="px-2 py-2">{result.algorithmId}</td>
                  <td className="px-2 py-2 text-right">{result.metrics.elapsedMs}</td>
                  <td className="px-2 py-2 text-right">{result.metrics.expanded}</td>
                  <td className="px-2 py-2 text-right">{result.metrics.generated}</td>
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
