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

function sortComparableInputs(
  inputs: BenchmarkComparableRunInput[],
): BenchmarkComparableRunInput[] {
  return [...inputs].sort((left, right) => {
    return serializeComparableRunInput(left).localeCompare(serializeComparableRunInput(right));
  });
}

export function toComparableRunInput(
  record: BenchmarkRunRecord,
): BenchmarkComparableRunInput | null {
  if (!record.comparableMetadata) {
    return null;
  }

  return {
    levelId: record.levelId,
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
