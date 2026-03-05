import {
  BENCHMARK_DB_INDEXES,
  BENCHMARK_DB_NAME,
  BENCHMARK_DB_STORES,
  BENCHMARK_DB_VERSION,
  type BenchmarkRunRecord,
  isBenchmarkRunRecord,
} from '@corgiban/benchmarks';

type BenchmarkRepositoryLogger = Pick<Console, 'warn'>;

type CreateBenchmarkRepositoryOptions = {
  indexedDBFactory?: IDBFactory;
  logger?: BenchmarkRepositoryLogger;
};

type MigrationDatabase = Pick<IDBDatabase, 'objectStoreNames' | 'createObjectStore'>;
type MigrationTransaction = Pick<IDBTransaction, 'objectStore'>;

type BenchmarkDatabaseMigrationContext = {
  database: MigrationDatabase;
  transaction: MigrationTransaction | null;
  oldVersion: number;
};

export type BenchmarkRepository = {
  loadRuns: () => Promise<BenchmarkRunRecord[]>;
  saveRun: (run: BenchmarkRunRecord) => Promise<void>;
  replaceRuns: (runs: BenchmarkRunRecord[]) => Promise<void>;
  clearRuns: () => Promise<void>;
  deleteRuns: (runIds: string[]) => Promise<void>;
  dispose: () => void;
};

function ensureRunStore(context: BenchmarkDatabaseMigrationContext): IDBObjectStore {
  if (context.database.objectStoreNames.contains(BENCHMARK_DB_STORES.runs)) {
    if (!context.transaction) {
      throw new Error('IndexedDB migration transaction is required for existing benchmark store.');
    }
    return context.transaction.objectStore(BENCHMARK_DB_STORES.runs);
  }

  return context.database.createObjectStore(BENCHMARK_DB_STORES.runs, { keyPath: 'id' });
}

function ensureRunStoreIndexes(store: Pick<IDBObjectStore, 'indexNames' | 'createIndex'>): void {
  if (!store.indexNames.contains(BENCHMARK_DB_INDEXES.runsBySuiteRunId)) {
    store.createIndex(BENCHMARK_DB_INDEXES.runsBySuiteRunId, 'suiteRunId', { unique: false });
  }

  if (!store.indexNames.contains(BENCHMARK_DB_INDEXES.runsByFinishedAtMs)) {
    store.createIndex(BENCHMARK_DB_INDEXES.runsByFinishedAtMs, 'finishedAtMs', { unique: false });
  }
}

export function migrateBenchmarkDatabase(context: BenchmarkDatabaseMigrationContext): void {
  if (context.oldVersion < 1) {
    const store = ensureRunStore(context);
    ensureRunStoreIndexes(store);
    return;
  }

  if (context.oldVersion < BENCHMARK_DB_VERSION) {
    const store = ensureRunStore(context);
    ensureRunStoreIndexes(store);
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
    };
  });
}

function openBenchmarkDatabase(indexedDBFactory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDBFactory.open(BENCHMARK_DB_NAME, BENCHMARK_DB_VERSION);

    request.onupgradeneeded = (event) => {
      migrateBenchmarkDatabase({
        database: request.result,
        transaction: request.transaction,
        oldVersion: event.oldVersion,
      });
    };

    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open benchmark IndexedDB.'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

export function createBenchmarkRepository(
  options: CreateBenchmarkRepositoryOptions = {},
): BenchmarkRepository {
  const indexedDBFactory = options.indexedDBFactory ?? globalThis.indexedDB;
  const logger = options.logger ?? console;

  if (!indexedDBFactory) {
    throw new Error('IndexedDB is not available in this environment.');
  }

  let openPromise: Promise<IDBDatabase> | null = null;
  let database: IDBDatabase | null = null;

  const getDatabase = async (): Promise<IDBDatabase> => {
    if (database) {
      return database;
    }

    if (!openPromise) {
      openPromise = openBenchmarkDatabase(indexedDBFactory)
        .then((openedDatabase) => {
          database = openedDatabase;
          return openedDatabase;
        })
        .catch((error) => {
          // Allow subsequent operations to retry IndexedDB open after transient failures.
          openPromise = null;
          throw error;
        });
    }

    return openPromise;
  };

  return {
    async loadRuns() {
      const db = await getDatabase();
      const transaction = db.transaction(BENCHMARK_DB_STORES.runs, 'readonly');
      const store = transaction.objectStore(BENCHMARK_DB_STORES.runs);

      const rawResults = await requestToPromise<unknown[]>(store.getAll());
      await transactionCompleted(transaction);

      const results: BenchmarkRunRecord[] = [];
      rawResults.forEach((record) => {
        if (isBenchmarkRunRecord(record)) {
          results.push(record);
          return;
        }

        logger.warn('[bench] Ignoring invalid benchmark run record from IndexedDB.', record);
      });

      return results;
    },

    async saveRun(run) {
      const db = await getDatabase();
      const transaction = db.transaction(BENCHMARK_DB_STORES.runs, 'readwrite');
      const store = transaction.objectStore(BENCHMARK_DB_STORES.runs);
      store.put(run);
      await transactionCompleted(transaction);
    },

    async replaceRuns(runs) {
      const db = await getDatabase();
      const transaction = db.transaction(BENCHMARK_DB_STORES.runs, 'readwrite');
      const store = transaction.objectStore(BENCHMARK_DB_STORES.runs);
      store.clear();
      runs.forEach((run) => {
        store.put(run);
      });
      await transactionCompleted(transaction);
    },

    async clearRuns() {
      const db = await getDatabase();
      const transaction = db.transaction(BENCHMARK_DB_STORES.runs, 'readwrite');
      const store = transaction.objectStore(BENCHMARK_DB_STORES.runs);
      store.clear();
      await transactionCompleted(transaction);
    },

    async deleteRuns(runIds) {
      if (runIds.length === 0) {
        return;
      }

      const db = await getDatabase();
      const transaction = db.transaction(BENCHMARK_DB_STORES.runs, 'readwrite');
      const store = transaction.objectStore(BENCHMARK_DB_STORES.runs);

      runIds.forEach((runId) => {
        store.delete(runId);
      });

      await transactionCompleted(transaction);
    },

    dispose() {
      if (database) {
        database.close();
        database = null;
      }
      openPromise = null;
    },
  };
}
