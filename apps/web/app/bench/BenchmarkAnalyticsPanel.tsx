import { useEffect, useId, useMemo, useState } from 'react';

import type { BenchmarkRunRecord } from '../ports/benchmarkPort';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import {
  buildComparisonSnapshot,
  buildSuiteComparisons,
  getDefaultBaselineSuiteRunId,
  toSuiteAnalytics,
  type BenchmarkComparisonSnapshot,
} from './benchmarkAnalytics';

export type BenchmarkAnalyticsPanelProps = {
  results: BenchmarkRunRecord[];
  onExportSnapshot: (snapshot: BenchmarkComparisonSnapshot) => void;
};

function percentText(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function metricText(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(1);
}

function deltaPercentText(value: number | null): string {
  if (value === null) return 'n/a';
  const formatted = (value * 100).toFixed(1);
  return value > 0 ? `+${formatted}%` : `${formatted}%`;
}

function deltaMetricText(value: number | null): string {
  if (value === null) return 'n/a';
  const formatted = value.toFixed(1);
  return value > 0 ? `+${formatted}` : formatted;
}

function comparisonLabel(
  suiteRunId: string,
  baselineSuiteRunId: string | null,
  comparable: boolean,
): string {
  if (comparable && baselineSuiteRunId === suiteRunId) {
    return 'Baseline';
  }
  if (comparable) {
    return 'Comparable';
  }
  return 'Not comparable';
}

export function BenchmarkAnalyticsPanel({
  results,
  onExportSnapshot,
}: BenchmarkAnalyticsPanelProps) {
  const headingId = useId();
  const suites = useMemo(() => toSuiteAnalytics(results), [results]);
  const [baselineSuiteRunId, setBaselineSuiteRunId] = useState<string>('');
  const defaultBaselineSuiteRunId = getDefaultBaselineSuiteRunId(suites);

  useEffect(() => {
    if (
      baselineSuiteRunId.length > 0 &&
      !suites.some((suite) => suite.suiteRunId === baselineSuiteRunId)
    ) {
      setBaselineSuiteRunId('');
    }
  }, [baselineSuiteRunId, suites]);

  const resolvedBaselineId =
    baselineSuiteRunId.length > 0 ? baselineSuiteRunId : defaultBaselineSuiteRunId;

  const baseline = suites.find((suite) => suite.suiteRunId === resolvedBaselineId) ?? null;

  const comparisons = useMemo(() => buildSuiteComparisons(suites, baseline), [baseline, suites]);
  const comparisonsBySuite = new Map(comparisons.map((item) => [item.suiteRunId, item]));
  const snapshot = buildComparisonSnapshot(baseline, suites, comparisons);
  const nonComparableSuites = comparisons.filter((comparison) => !comparison.comparable);

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            Analytics & Comparison
          </h2>
          <p className="text-sm text-muted">
            Compare persisted suite runs only when their stored run inputs, solver options, warm-up
            settings, and environment metadata match exactly.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={snapshot ? () => onExportSnapshot(snapshot) : undefined}
          disabled={!snapshot}
        >
          Export Comparison Snapshot
        </Button>
      </div>

      {suites.length === 0 ? (
        <p className="rounded-app-md border border-dashed border-border px-3 py-4 text-sm text-muted">
          Run at least one suite to generate analytics.
        </p>
      ) : (
        <>
          <div className="mb-3 max-w-xs">
            <Select
              label="Baseline suite"
              value={baselineSuiteRunId}
              onChange={(event) => setBaselineSuiteRunId(event.target.value)}
            >
              <option value="">
                {baseline
                  ? `Auto (${baseline.suiteLabel})`
                  : 'Auto (select most recent comparable suite)'}
              </option>
              {suites.map((suite) => (
                <option key={suite.suiteRunId} value={suite.suiteRunId}>
                  {suite.suiteLabel}
                </option>
              ))}
            </Select>
          </div>

          {baseline && baseline.comparisonFingerprint === null ? (
            <p className="mb-3 rounded-app-md border border-dashed border-border px-3 py-2 text-sm text-muted">
              {baseline.comparisonIssues[0] ??
                'Select a suite with complete comparable metadata to export a comparison snapshot.'}
            </p>
          ) : null}

          {nonComparableSuites.length > 0 ? (
            <p className="mb-3 rounded-app-md border border-dashed border-border px-3 py-2 text-sm text-muted">
              Non-comparable suites:{' '}
              {nonComparableSuites
                .map((comparison) => {
                  return `${comparison.suiteRunId} (${comparison.reason ?? 'comparison unavailable'})`;
                })
                .join(', ')}
            </p>
          ) : null}

          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <caption className="sr-only">
                Suite analytics and comparison. {suites.length}{' '}
                {suites.length === 1 ? 'suite' : 'suites'} recorded.
              </caption>
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th scope="col" className="px-2 py-2">
                    Suite
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Runs
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Success
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    <abbr title="50th percentile elapsed time in milliseconds">p50 (ms)</abbr>
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    <abbr title="95th percentile elapsed time in milliseconds">p95 (ms)</abbr>
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Comparison
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    Delta success
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    <abbr title="Delta 50th percentile">Delta p50</abbr>
                  </th>
                  <th scope="col" className="px-2 py-2 text-right">
                    <abbr title="Delta 95th percentile">Delta p95</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {suites.map((suite) => {
                  const comparison = comparisonsBySuite.get(suite.suiteRunId)!;
                  return (
                    <tr key={suite.suiteRunId} className="border-b border-border/60">
                      <td className="px-2 py-2" title={suite.suiteLabel}>
                        {suite.suiteRunId}
                      </td>
                      <td className="px-2 py-2 text-right">{suite.runs}</td>
                      <td className="px-2 py-2 text-right">{percentText(suite.successRate)}</td>
                      <td className="px-2 py-2 text-right">{suite.p50ElapsedMs.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right">{suite.p95ElapsedMs.toFixed(1)}</td>
                      <td className="px-2 py-2 text-right" title={comparison.reason ?? undefined}>
                        {comparisonLabel(
                          suite.suiteRunId,
                          baseline?.suiteRunId ?? null,
                          comparison.comparable,
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {deltaPercentText(comparison.deltaSuccessRate)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {deltaMetricText(comparison.deltaP50ElapsedMs)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {deltaMetricText(comparison.deltaP95ElapsedMs)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
