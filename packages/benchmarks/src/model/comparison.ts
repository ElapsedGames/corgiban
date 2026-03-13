import type { BenchmarkComparableMetadata, BenchmarkRunRecord } from './benchmarkTypes';

export type BenchmarkComparableRunInput = {
  levelId: string;
  repetition: number;
  solver: BenchmarkComparableMetadata['solver'];
  environment: BenchmarkComparableMetadata['environment'];
  warmupEnabled: boolean;
  warmupRepetitions: number;
};

export type BenchmarkSuiteComparisonInfo = {
  fingerprint: string | null;
  inputs: BenchmarkComparableRunInput[];
  issues: string[];
};

function serializeComparableRunInput(input: BenchmarkComparableRunInput): string {
  return JSON.stringify({
    levelId: input.levelId,
    repetition: input.repetition,
    solver: {
      algorithmId: input.solver.algorithmId,
      heuristicId: input.solver.heuristicId ?? null,
      heuristicWeight: input.solver.heuristicWeight ?? null,
      timeBudgetMs: input.solver.timeBudgetMs ?? null,
      nodeBudget: input.solver.nodeBudget ?? null,
      enableSpectatorStream: input.solver.enableSpectatorStream ?? null,
    },
    environment: {
      userAgent: input.environment.userAgent,
      hardwareConcurrency: input.environment.hardwareConcurrency,
      appVersion: input.environment.appVersion,
    },
    warmupEnabled: input.warmupEnabled,
    warmupRepetitions: input.warmupRepetitions,
  });
}

/**
 * Sorts comparable run inputs into a canonical, locale-independent order.
 *
 * Ordering contract (all comparisons are ordinal / byte-order):
 *   1. Primary:   levelId ascending (ordinal string comparison, not locale-aware)
 *   2. Secondary: repetition ascending (numeric)
 *   3. Tertiary:  full serialized JSON string ascending (ordinal) - breaks ties
 *                 caused by identical levelId+repetition but differing solver/
 *                 environment config, and ensures a fully deterministic result.
 *
 * Using `localeCompare` would make the sort order (and therefore the fingerprint)
 * vary across browsers, operating systems, and Node.js ICU configurations.
 */
function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function sortComparableInputs(
  inputs: BenchmarkComparableRunInput[],
): BenchmarkComparableRunInput[] {
  return [...inputs].sort((left, right) => {
    // 1. levelId - ordinal, locale-independent
    const byLevel = compareOrdinal(left.levelId, right.levelId);
    if (byLevel !== 0) return byLevel;

    // 2. repetition - numeric
    if (left.repetition !== right.repetition) {
      return left.repetition - right.repetition;
    }

    // 3. full serialized shape - ordinal tiebreaker for differing configs
    return compareOrdinal(serializeComparableRunInput(left), serializeComparableRunInput(right));
  });
}

export function toComparableRunInput(
  record: BenchmarkRunRecord,
): BenchmarkComparableRunInput | null {
  if (!record.comparableMetadata) {
    return null;
  }

  return {
    levelId: record.comparisonLevelKey ?? record.levelId,
    repetition: record.repetition,
    solver: record.comparableMetadata.solver,
    environment: record.comparableMetadata.environment,
    warmupEnabled: record.comparableMetadata.warmupEnabled,
    warmupRepetitions: record.comparableMetadata.warmupRepetitions,
  };
}

export function buildSuiteComparisonInfo(
  records: BenchmarkRunRecord[],
): BenchmarkSuiteComparisonInfo {
  if (records.length === 0) {
    return {
      fingerprint: null,
      inputs: [],
      issues: ['Benchmark suite has no measured results.'],
    };
  }

  const issues: string[] = [];
  const inputs = records.flatMap((record) => {
    const input = toComparableRunInput(record);
    if (input) {
      return [input];
    }

    issues.push(`Missing comparable metadata for run ${record.runId}.`);
    return [];
  });

  const sortedInputs = sortComparableInputs(inputs);
  if (issues.length > 0) {
    return {
      fingerprint: null,
      inputs: sortedInputs,
      issues,
    };
  }

  return {
    fingerprint: JSON.stringify(sortedInputs.map((input) => serializeComparableRunInput(input))),
    inputs: sortedInputs,
    issues: [],
  };
}
