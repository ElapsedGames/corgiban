import { DEFAULT_BENCHMARK_RETENTION_LIMIT, type BenchmarkRunRecord } from '@corgiban/benchmarks';

import {
  applyRetentionLimit,
  createNoopBenchmarkStorage,
  sortByCompletion,
  upsertMemoryResult,
  type BenchmarkStorage,
  type PersistOutcome,
} from './benchmarkStorage';
import { createBenchmarkRepository, type BenchmarkRepository } from './benchmarkRepository.client';

export { createNoopBenchmarkStorage } from './benchmarkStorage';
export type {
  BenchmarkStorage,
  BenchmarkStorageInitResult,
  PersistOutcome,
} from './benchmarkStorage';

type StoragePersistApi = {
  persist?: () => Promise<boolean>;
};

type BenchmarkStorageNavigator = {
  storage?: StoragePersistApi;
};

type BenchmarkStorageLogger = Pick<Console, 'info' | 'warn'>;

type CreateBenchmarkStorageOptions = {
  indexedDBFactory?: IDBFactory;
  navigatorLike?: BenchmarkStorageNavigator;
  logger?: BenchmarkStorageLogger;
  isDev?: boolean;
  retentionLimit?: number;
  repository?: BenchmarkRepository | null;
};

function normalizeRetentionLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return DEFAULT_BENCHMARK_RETENTION_LIMIT;
  }

  return Math.floor(limit);
}

async function requestStoragePersistence(
  navigatorLike: BenchmarkStorageNavigator | undefined,
): Promise<PersistOutcome> {
  const storage = navigatorLike?.storage;
  const persist = storage?.persist;

  if (typeof persist !== 'function') {
    return 'unsupported';
  }

  try {
    const granted = await persist.call(storage);
    return granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

function shouldLogDiagnostics(isDev: boolean, debug: boolean): boolean {
  return isDev && debug;
}

async function syncResultsFromRepository(params: {
  repository: BenchmarkRepository;
  retentionLimit: number;
  logger: BenchmarkStorageLogger;
}): Promise<BenchmarkRunRecord[]> {
  const loadedResults = await params.repository.loadRuns();
  const retention = applyRetentionLimit(loadedResults, params.retentionLimit);

  if (retention.droppedIds.length > 0) {
    await params.repository.deleteRuns(retention.droppedIds);
  }

  return retention.retainedResults;
}

export function createBenchmarkStorage(
  options: CreateBenchmarkStorageOptions = {},
): BenchmarkStorage {
  const indexedDBFactory = options.indexedDBFactory ?? globalThis.indexedDB;
  const navigatorLike = options.navigatorLike ?? globalThis.navigator;
  const logger = options.logger ?? console;
  const isDev = options.isDev ?? Boolean(import.meta.env?.DEV);
  const retentionLimit = normalizeRetentionLimit(options.retentionLimit);

  const repository =
    options.repository === undefined
      ? indexedDBFactory
        ? createBenchmarkRepository({
            indexedDBFactory,
            logger,
          })
        : null
      : options.repository;

  let memoryResults: BenchmarkRunRecord[] = [];

  return {
    async init(initOptions) {
      const persistOutcome = await requestStoragePersistence(navigatorLike);

      if (shouldLogDiagnostics(isDev, Boolean(initOptions?.debug))) {
        logger.info(`[bench] storage.persist outcome: ${persistOutcome}`);
      }

      if (repository) {
        try {
          memoryResults = await syncResultsFromRepository({
            repository,
            retentionLimit,
            logger,
          });
        } catch (error) {
          logger.warn('[bench] Failed to initialize benchmark repository.', error);
        }
      }

      return { persistOutcome };
    },

    async loadResults() {
      if (!repository) {
        return sortByCompletion(memoryResults);
      }

      try {
        memoryResults = await syncResultsFromRepository({
          repository,
          retentionLimit,
          logger,
        });
      } catch (error) {
        logger.warn('[bench] Failed to load benchmark runs from repository.', error);
      }

      return memoryResults;
    },

    async saveResult(result) {
      upsertMemoryResult(memoryResults, result);
      const retention = applyRetentionLimit(memoryResults, retentionLimit);
      memoryResults = retention.retainedResults;

      if (!repository) {
        return;
      }

      try {
        await repository.saveRun(result);

        if (retention.droppedIds.length > 0) {
          await repository.deleteRuns(retention.droppedIds);
        }
      } catch (error) {
        logger.warn('[bench] Failed to persist benchmark result.', error);
        throw error;
      }
    },

    async replaceResults(results) {
      const retention = applyRetentionLimit(results, retentionLimit);
      memoryResults = retention.retainedResults;

      if (!repository) {
        return;
      }

      try {
        await repository.replaceRuns(memoryResults);
      } catch (error) {
        logger.warn('[bench] Failed to replace benchmark results in repository.', error);
        throw error;
      }
    },

    async clearResults() {
      memoryResults = [];

      if (!repository) {
        return;
      }

      try {
        await repository.clearRuns();
      } catch (error) {
        logger.warn('[bench] Failed to clear benchmark results in repository.', error);
        throw error;
      }
    },

    dispose() {
      repository?.dispose();
    },
  };
}
