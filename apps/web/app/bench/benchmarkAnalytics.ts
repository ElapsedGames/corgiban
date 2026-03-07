import { buildSuiteComparisonInfo, type BenchmarkComparableRunInput } from '@corgiban/benchmarks';

import type { BenchmarkRunRecord } from '../ports/benchmarkPort';

export type SuiteAnalytics = {
  suiteRunId: string;
  runs: number;
  solvedRuns: number;
  successRate: number;
  p50ElapsedMs: number;
  p95ElapsedMs: number;
  latestFinishedAtMs: number;
  algorithmSummary: string;
  suiteLabel: string;
  comparisonFingerprint: string | null;
  comparisonInputs: BenchmarkComparableRunInput[];
  comparisonIssues: string[];
};

export type SuiteComparison = {
  suiteRunId: string;
  comparable: boolean;
  reason: string | null;
  deltaSuccessRate: number | null;
  deltaP50ElapsedMs: number | null;
  deltaP95ElapsedMs: number | null;
};

export type BenchmarkComparisonSnapshot = {
  type: 'corgiban-benchmark-comparison';
  version: 2;
  comparisonModel: 'strict-suite-input-fingerprint';
  baselineSuiteRunId: string;
  generatedAtIso: string;
  suites: SuiteAnalytics[];
  comparisons: SuiteComparison[];
};

function firstIssueOrFallback(issues: string[], fallback: string): string {
  return issues[0] ?? fallback;
}

function resolveComparisonReason(
  baseline: SuiteAnalytics | null,
  suite: SuiteAnalytics,
): string | null {
  if (!baseline) {
    return 'Selected baseline suite is unavailable.';
  }

  if (baseline.comparisonFingerprint === null) {
    return firstIssueOrFallback(
      baseline.comparisonIssues,
      'Selected baseline suite lacks comparable metadata.',
    );
  }

  if (suite.comparisonFingerprint === null) {
    return firstIssueOrFallback(
      suite.comparisonIssues,
      'Suite lacks comparable metadata required for comparison.',
    );
  }

  if (suite.comparisonFingerprint !== baseline.comparisonFingerprint) {
    return 'Suite inputs or comparable metadata differ from the selected baseline.';
  }

  return null;
}

function formatSuiteTimestamp(timestampMs: number): string {
  return new Date(timestampMs).toISOString();
}

function summarizeAlgorithms(results: BenchmarkRunRecord[]): string {
  const algorithmIds = Array.from(new Set(results.map((result) => result.algorithmId))).sort();
  const firstAlgorithm = algorithmIds[0];
  if (!firstAlgorithm) {
    return 'unknown-algorithm';
  }
  if (algorithmIds.length === 1) {
    return firstAlgorithm;
  }
  return `${firstAlgorithm} +${algorithmIds.length - 1} more`;
}

function formatRunCount(runs: number): string {
  return runs === 1 ? '1 run' : `${runs} runs`;
}

export function buildSuiteLabel(
  suite: Pick<SuiteAnalytics, 'latestFinishedAtMs' | 'algorithmSummary' | 'runs' | 'suiteRunId'>,
): string {
  return [
    formatSuiteTimestamp(suite.latestFinishedAtMs),
    suite.algorithmSummary,
    formatRunCount(suite.runs),
    suite.suiteRunId,
  ].join(' | ');
}

export function quantile(sorted: number[], percentile: number): number {
  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length === 1) {
    return sorted[0];
  }

  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = position - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

export function toSuiteAnalytics(results: BenchmarkRunRecord[]): SuiteAnalytics[] {
  const bySuite = new Map<string, BenchmarkRunRecord[]>();

  results.forEach((result) => {
    if (result.warmup === true) {
      return;
    }

    const existing = bySuite.get(result.suiteRunId) ?? [];
    existing.push(result);
    bySuite.set(result.suiteRunId, existing);
  });

  return [...bySuite.entries()]
    .map(([suiteRunId, suiteResults]) => {
      const elapsed = suiteResults
        .map((result) => result.metrics.elapsedMs)
        .sort((left, right) => left - right);
      const solvedRuns = suiteResults.filter((result) => result.status === 'solved').length;
      const comparisonInfo = buildSuiteComparisonInfo(suiteResults);
      const latestFinishedAtMs = Math.max(...suiteResults.map((result) => result.finishedAtMs));
      const algorithmSummary = summarizeAlgorithms(suiteResults);

      return {
        suiteRunId,
        runs: suiteResults.length,
        solvedRuns,
        successRate: solvedRuns / suiteResults.length,
        p50ElapsedMs: quantile(elapsed, 0.5),
        p95ElapsedMs: quantile(elapsed, 0.95),
        latestFinishedAtMs,
        algorithmSummary,
        suiteLabel: buildSuiteLabel({
          latestFinishedAtMs,
          algorithmSummary,
          runs: suiteResults.length,
          suiteRunId,
        }),
        comparisonFingerprint: comparisonInfo.fingerprint,
        comparisonInputs: comparisonInfo.inputs,
        comparisonIssues: comparisonInfo.issues,
      };
    })
    .sort((left, right) => {
      const timestampDelta = right.latestFinishedAtMs - left.latestFinishedAtMs;
      if (timestampDelta !== 0) {
        return timestampDelta;
      }
      return left.suiteRunId.localeCompare(right.suiteRunId);
    });
}

export function getDefaultBaselineSuiteRunId(suites: SuiteAnalytics[]): string {
  const comparableSuite = suites.find((suite) => suite.comparisonFingerprint !== null);
  return comparableSuite?.suiteRunId ?? suites[0]?.suiteRunId ?? '';
}

export function buildSuiteComparisons(
  suites: SuiteAnalytics[],
  baseline: SuiteAnalytics | null,
): SuiteComparison[] {
  return suites.map((suite) => {
    const reason = resolveComparisonReason(baseline, suite);
    if (reason) {
      return {
        suiteRunId: suite.suiteRunId,
        comparable: false,
        reason,
        deltaSuccessRate: null,
        deltaP50ElapsedMs: null,
        deltaP95ElapsedMs: null,
      };
    }

    return {
      suiteRunId: suite.suiteRunId,
      comparable: true,
      reason: null,
      deltaSuccessRate: suite.successRate - (baseline?.successRate ?? 0),
      deltaP50ElapsedMs: suite.p50ElapsedMs - (baseline?.p50ElapsedMs ?? 0),
      deltaP95ElapsedMs: suite.p95ElapsedMs - (baseline?.p95ElapsedMs ?? 0),
    };
  });
}

export function buildComparisonSnapshot(
  baseline: SuiteAnalytics | null,
  suites: SuiteAnalytics[],
  comparisons: SuiteComparison[],
  generatedAtIso: string = new Date().toISOString(),
): BenchmarkComparisonSnapshot | null {
  if (!baseline || baseline.comparisonFingerprint === null) {
    return null;
  }

  return {
    type: 'corgiban-benchmark-comparison',
    version: 2,
    comparisonModel: 'strict-suite-input-fingerprint',
    baselineSuiteRunId: baseline.suiteRunId,
    generatedAtIso,
    suites,
    comparisons,
  };
}
