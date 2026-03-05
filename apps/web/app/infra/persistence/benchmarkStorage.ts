import { DEFAULT_BENCHMARK_RETENTION_LIMIT, type BenchmarkRunRecord } from '@corgiban/benchmarks';

import type {
  PersistOutcome,
  PersistencePort,
  PersistencePortInitResult,
  RepositoryHealth,
} from '../../ports/persistencePort';

export type { PersistOutcome, RepositoryHealth } from '../../ports/persistencePort';

export type BenchmarkStorageInitResult = PersistencePortInitResult;
export type BenchmarkStorage = PersistencePort;

export type RetentionResult = {
  retainedResults: BenchmarkRunRecord[];
  droppedIds: string[];
};

export function upsertMemoryResult(
  memoryResults: BenchmarkRunRecord[],
  result: BenchmarkRunRecord,
) {
  const existingIndex = memoryResults.findIndex((entry) => entry.id === result.id);
  if (existingIndex >= 0) {
    memoryResults[existingIndex] = result;
    return;
  }

  memoryResults.push(result);
}

export function sortByCompletion(results: BenchmarkRunRecord[]): BenchmarkRunRecord[] {
  return [...results].sort((left, right) => {
    if (left.finishedAtMs !== right.finishedAtMs) {
      return left.finishedAtMs - right.finishedAtMs;
    }

    if (left.startedAtMs !== right.startedAtMs) {
      return left.startedAtMs - right.startedAtMs;
    }

    return left.id.localeCompare(right.id);
  });
}

export function applyRetentionLimit(
  results: BenchmarkRunRecord[],
  retentionLimit: number,
): RetentionResult {
  if (results.length <= retentionLimit) {
    return {
      retainedResults: sortByCompletion(results),
      droppedIds: [],
    };
  }

  const newestFirst = [...results].sort((left, right) => {
    if (left.finishedAtMs !== right.finishedAtMs) {
      return right.finishedAtMs - left.finishedAtMs;
    }

    if (left.startedAtMs !== right.startedAtMs) {
      return right.startedAtMs - left.startedAtMs;
    }

    return left.id.localeCompare(right.id);
  });

  const retained = newestFirst.slice(0, retentionLimit);
  const retainedIds = new Set(retained.map((result) => result.id));
  const droppedIds = results
    .filter((result) => !retainedIds.has(result.id))
    .map((result) => result.id)
    .sort();

  return {
    retainedResults: sortByCompletion(retained),
    droppedIds,
  };
}

export function createNoopBenchmarkStorage(): BenchmarkStorage {
  const retentionLimit = DEFAULT_BENCHMARK_RETENTION_LIMIT;
  const memoryResults: BenchmarkRunRecord[] = [];

  return {
    init: async (): Promise<BenchmarkStorageInitResult> => ({
      persistOutcome: 'unsupported',
      repositoryHealth: 'unavailable',
    }),
    loadResults: async () => sortByCompletion(memoryResults),
    saveResult: async (result) => {
      upsertMemoryResult(memoryResults, result);
      const retention = applyRetentionLimit(memoryResults, retentionLimit);
      memoryResults.length = 0;
      memoryResults.push(...retention.retainedResults);
    },
    replaceResults: async (results) => {
      const retention = applyRetentionLimit(results, retentionLimit);
      memoryResults.length = 0;
      memoryResults.push(...retention.retainedResults);
    },
    clearResults: async () => {
      memoryResults.length = 0;
    },
    getRepositoryHealth: (): RepositoryHealth => 'unavailable',
    getLastRepositoryError: () => null,
    dispose: () => undefined,
  };
}
