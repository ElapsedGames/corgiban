import { describe, expect, it, vi } from 'vitest';

import type { BenchmarkRunRecord } from '@corgiban/benchmarks';

import { createBenchmarkRepository } from '../benchmarkRepository.client';

type TransactionMode = 'complete' | 'error' | 'abort';

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'suite-1',
    runId: 'suite-1:run-1',
    sequence: 1,
    levelId: 'level-1',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1000,
      nodeBudget: 500,
    },
    status: 'unsolved',
    metrics: {
      elapsedMs: 10,
      expanded: 20,
      generated: 30,
      maxDepth: 4,
      maxFrontier: 5,
      pushCount: 2,
      moveCount: 6,
    },
    startedAtMs: 100,
    finishedAtMs: 110,
    environment: {
      userAgent: 'vitest',
      hardwareConcurrency: 8,
      appVersion: 'test',
    },
    ...overrides,
  };
}

function createAsyncRequest<T>(config: {
  result?: T;
  error?: Error;
  fail?: boolean;
}): IDBRequest<T> {
  const request = {
    result: config.result as T,
    error: config.fail ? (config.error ?? new Error('IndexedDB request failed.')) : null,
    onsuccess: null as IDBRequest<T>['onsuccess'],
    onerror: null as IDBRequest<T>['onerror'],
  };

  setTimeout(() => {
    if (config.fail) {
      request.onerror?.call(request as unknown as IDBRequest<T>, new Event('error'));
      return;
    }
    request.onsuccess?.call(request as unknown as IDBRequest<T>, new Event('success'));
  }, 0);

  return request as unknown as IDBRequest<T>;
}

function createTransaction(store: IDBObjectStore, mode: TransactionMode): IDBTransaction {
  let oncomplete: IDBTransaction['oncomplete'] = null;
  let onerror: IDBTransaction['onerror'] = null;
  let onabort: IDBTransaction['onabort'] = null;

  const maybeScheduleEvent = () => {
    if (mode === 'complete' && oncomplete) {
      setTimeout(() => {
        oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'));
      }, 0);
      return;
    }
    if (mode === 'error' && onerror) {
      setTimeout(() => {
        onerror?.call(transaction as unknown as IDBTransaction, new Event('error'));
      }, 0);
      return;
    }
    if (mode === 'abort' && onabort) {
      setTimeout(() => {
        onabort?.call(transaction as unknown as IDBTransaction, new Event('abort'));
      }, 0);
    }
  };

  const transaction = {
    error:
      mode === 'complete'
        ? null
        : mode === 'error'
          ? new Error('transaction failed')
          : new Error('transaction aborted'),
    objectStore: vi.fn(() => store),
    get oncomplete() {
      return oncomplete;
    },
    set oncomplete(value: IDBTransaction['oncomplete']) {
      oncomplete = value;
      maybeScheduleEvent();
    },
    get onerror() {
      return onerror;
    },
    set onerror(value: IDBTransaction['onerror']) {
      onerror = value;
      maybeScheduleEvent();
    },
    get onabort() {
      return onabort;
    },
    set onabort(value: IDBTransaction['onabort']) {
      onabort = value;
      maybeScheduleEvent();
    },
  };

  return transaction as unknown as IDBTransaction;
}

function createRepositoryHarness(initialRecords: unknown[] = []) {
  let records = [...initialRecords];
  let openCalls = 0;
  let failOpen = false;
  let failNextGetAll = false;
  const transactionModes: TransactionMode[] = [];
  const logger = {
    warn: vi.fn(),
  };

  const indexNames = {
    contains: (_name: string) => true,
  } as DOMStringList;

  const store = {
    indexNames,
    createIndex: vi.fn(),
    getAll: vi.fn(() => {
      if (failNextGetAll) {
        failNextGetAll = false;
        return createAsyncRequest<unknown[]>({
          fail: true,
          error: new Error('getAll failed'),
        });
      }

      return createAsyncRequest<unknown[]>({
        result: [...records],
      });
    }),
    put: vi.fn((record: BenchmarkRunRecord) => {
      const existing = records.findIndex(
        (entry): entry is BenchmarkRunRecord =>
          typeof entry === 'object' && entry !== null && 'id' in entry && entry.id === record.id,
      );
      if (existing >= 0) {
        records[existing] = record;
        return;
      }
      records.push(record);
    }),
    clear: vi.fn(() => {
      records = [];
    }),
    delete: vi.fn((runId: string) => {
      records = records.filter(
        (entry) =>
          !(
            typeof entry === 'object' &&
            entry !== null &&
            'id' in entry &&
            (entry as { id?: unknown }).id === runId
          ),
      );
    }),
  } as unknown as IDBObjectStore;

  let hasRunsStore = false;

  const database = {
    objectStoreNames: {
      contains: (name: string) => hasRunsStore && name === 'benchmarkResults',
    } as DOMStringList,
    createObjectStore: vi.fn(() => {
      hasRunsStore = true;
      return store;
    }),
    transaction: vi.fn((_name: string, _mode: IDBTransactionMode) => {
      const mode = transactionModes.shift() ?? 'complete';
      return createTransaction(store, mode);
    }),
    close: vi.fn(),
  } as unknown as IDBDatabase;

  const indexedDBFactory = {
    open: vi.fn((_name: string, _version?: number) => {
      openCalls += 1;
      const request = {
        result: database,
        transaction: null as IDBTransaction | null,
        error: failOpen ? new Error('open failed') : null,
        onupgradeneeded: null as IDBOpenDBRequest['onupgradeneeded'],
        onsuccess: null as IDBOpenDBRequest['onsuccess'],
        onerror: null as IDBOpenDBRequest['onerror'],
      };

      setTimeout(() => {
        if (failOpen) {
          request.onerror?.call(request as unknown as IDBRequest<IDBDatabase>, new Event('error'));
          return;
        }

        if (!hasRunsStore) {
          request.onupgradeneeded?.call(
            request as unknown as IDBOpenDBRequest,
            {
              oldVersion: 0,
            } as IDBVersionChangeEvent,
          );
        }
        request.onsuccess?.call(
          request as unknown as IDBRequest<IDBDatabase>,
          new Event('success'),
        );
      }, 0);

      return request as unknown as IDBOpenDBRequest;
    }),
  } as unknown as IDBFactory;

  return {
    indexedDBFactory,
    logger,
    store,
    database,
    getRecords: () => [...records],
    getOpenCalls: () => openCalls,
    setFailOpen: (value: boolean) => {
      failOpen = value;
    },
    failNextGetAll: () => {
      failNextGetAll = true;
    },
    pushTransactionMode: (mode: TransactionMode) => {
      transactionModes.push(mode);
    },
  };
}

describe('benchmarkRepository runtime', () => {
  it('throws when IndexedDB is unavailable', () => {
    expect(() =>
      createBenchmarkRepository({
        indexedDBFactory: null as unknown as IDBFactory,
      }),
    ).toThrow('IndexedDB is not available in this environment.');
  });

  it('loads runs, filters invalid rows, and warns for discarded records', async () => {
    const valid = createResult({ id: 'valid-1' });
    const harness = createRepositoryHarness([valid, { id: 42 }]);
    const repository = createBenchmarkRepository({
      indexedDBFactory: harness.indexedDBFactory,
      logger: harness.logger,
    });

    await expect(repository.loadRuns()).resolves.toEqual([valid]);
    expect(harness.logger.warn).toHaveBeenCalledWith(
      '[bench] Ignoring invalid benchmark run record from IndexedDB.',
      { id: 42 },
    );
  });

  it('supports save, replace, clear, and delete operations', async () => {
    const resultA = createResult({ id: 'a' });
    const resultB = createResult({ id: 'b' });
    const resultC = createResult({ id: 'c' });
    const harness = createRepositoryHarness([resultA]);
    const repository = createBenchmarkRepository({
      indexedDBFactory: harness.indexedDBFactory,
      logger: harness.logger,
    });

    await repository.saveRun(resultB);
    await repository.saveRun({ ...resultB, sequence: 99 });
    expect(harness.getRecords()).toEqual([resultA, { ...resultB, sequence: 99 }]);

    await repository.replaceRuns([resultC]);
    expect(harness.getRecords()).toEqual([resultC]);

    await repository.deleteRuns(['c']);
    expect(harness.getRecords()).toEqual([]);

    await repository.saveRun(resultA);
    await repository.clearRuns();
    expect(harness.getRecords()).toEqual([]);
  });

  it('returns early when deleteRuns receives an empty run-id list', async () => {
    const harness = createRepositoryHarness([createResult({ id: 'a' })]);
    const repository = createBenchmarkRepository({
      indexedDBFactory: harness.indexedDBFactory,
      logger: harness.logger,
    });

    await repository.deleteRuns([]);
    expect(harness.database.transaction).not.toHaveBeenCalled();
    expect(harness.getOpenCalls()).toBe(0);
  });

  it('propagates open, request, and transaction failures', async () => {
    const harnessOpen = createRepositoryHarness();
    harnessOpen.setFailOpen(true);
    const repositoryOpen = createBenchmarkRepository({
      indexedDBFactory: harnessOpen.indexedDBFactory,
      logger: harnessOpen.logger,
    });
    await expect(repositoryOpen.loadRuns()).rejects.toThrow('open failed');

    const harnessRequest = createRepositoryHarness([createResult({ id: 'x' })]);
    harnessRequest.failNextGetAll();
    const repositoryRequest = createBenchmarkRepository({
      indexedDBFactory: harnessRequest.indexedDBFactory,
      logger: harnessRequest.logger,
    });
    await expect(repositoryRequest.loadRuns()).rejects.toThrow('getAll failed');

    const harnessTxError = createRepositoryHarness();
    harnessTxError.pushTransactionMode('error');
    const repositoryTxError = createBenchmarkRepository({
      indexedDBFactory: harnessTxError.indexedDBFactory,
      logger: harnessTxError.logger,
    });
    await expect(repositoryTxError.saveRun(createResult({ id: 'tx-error' }))).rejects.toThrow(
      'transaction failed',
    );

    const harnessTxAbort = createRepositoryHarness();
    harnessTxAbort.pushTransactionMode('abort');
    const repositoryTxAbort = createBenchmarkRepository({
      indexedDBFactory: harnessTxAbort.indexedDBFactory,
      logger: harnessTxAbort.logger,
    });
    await expect(repositoryTxAbort.clearRuns()).rejects.toThrow('transaction aborted');
  });

  it('retries IndexedDB open after a failed open attempt without requiring dispose', async () => {
    const persistedResult = createResult({ id: 'retry-open' });
    const harness = createRepositoryHarness([persistedResult]);
    harness.setFailOpen(true);

    const repository = createBenchmarkRepository({
      indexedDBFactory: harness.indexedDBFactory,
      logger: harness.logger,
    });

    await expect(repository.loadRuns()).rejects.toThrow('open failed');
    expect(harness.getOpenCalls()).toBe(1);

    harness.setFailOpen(false);
    await expect(repository.loadRuns()).resolves.toEqual([persistedResult]);
    expect(harness.getOpenCalls()).toBe(2);
  });

  it('closes cached database handles on dispose and reopens lazily', async () => {
    const harness = createRepositoryHarness([createResult({ id: 'cached' })]);
    const repository = createBenchmarkRepository({
      indexedDBFactory: harness.indexedDBFactory,
      logger: harness.logger,
    });

    await repository.loadRuns();
    expect(harness.getOpenCalls()).toBe(1);

    repository.dispose();
    expect(harness.database.close).toHaveBeenCalledTimes(1);

    await repository.loadRuns();
    expect(harness.getOpenCalls()).toBe(2);
  });

  it('uses a fallback error message when opening IndexedDB fails without an error payload', async () => {
    const indexedDBFactory = {
      open: vi.fn(() => {
        const request = {
          result: null,
          transaction: null,
          error: null,
          onupgradeneeded: null as IDBOpenDBRequest['onupgradeneeded'],
          onsuccess: null as IDBOpenDBRequest['onsuccess'],
          onerror: null as IDBOpenDBRequest['onerror'],
        };

        setTimeout(() => {
          request.onerror?.call(request as unknown as IDBRequest<IDBDatabase>, new Event('error'));
        }, 0);

        return request as unknown as IDBOpenDBRequest;
      }),
    } as unknown as IDBFactory;

    const repository = createBenchmarkRepository({
      indexedDBFactory,
      logger: { warn: vi.fn() },
    });

    await expect(repository.loadRuns()).rejects.toThrow('Failed to open benchmark IndexedDB.');
  });

  it('uses a fallback error message when an IndexedDB request fails without an error payload', async () => {
    const store = {
      indexNames: { contains: () => true } as unknown as DOMStringList,
      createIndex: vi.fn(),
      getAll: vi.fn(() => {
        const request = {
          result: [] as unknown[],
          error: null,
          onsuccess: null as IDBRequest<unknown[]>['onsuccess'],
          onerror: null as IDBRequest<unknown[]>['onerror'],
        };

        setTimeout(() => {
          request.onerror?.call(request as unknown as IDBRequest<unknown[]>, new Event('error'));
        }, 0);

        return request as unknown as IDBRequest<unknown[]>;
      }),
    } as unknown as IDBObjectStore;

    const transaction = {
      error: null,
      objectStore: vi.fn(() => store),
      oncomplete: null as IDBTransaction['oncomplete'],
      onerror: null as IDBTransaction['onerror'],
      onabort: null as IDBTransaction['onabort'],
    } as unknown as IDBTransaction;

    const database = {
      objectStoreNames: {
        contains: () => true,
      } as unknown as DOMStringList,
      createObjectStore: vi.fn(() => store),
      transaction: vi.fn(() => transaction),
      close: vi.fn(),
    } as unknown as IDBDatabase;

    const indexedDBFactory = {
      open: vi.fn(() => {
        const request = {
          result: database,
          transaction,
          error: null,
          onupgradeneeded: null as IDBOpenDBRequest['onupgradeneeded'],
          onsuccess: null as IDBOpenDBRequest['onsuccess'],
          onerror: null as IDBOpenDBRequest['onerror'],
        };

        setTimeout(() => {
          request.onsuccess?.call(
            request as unknown as IDBRequest<IDBDatabase>,
            new Event('success'),
          );
        }, 0);

        return request as unknown as IDBOpenDBRequest;
      }),
    } as unknown as IDBFactory;

    const repository = createBenchmarkRepository({
      indexedDBFactory,
      logger: { warn: vi.fn() },
    });

    await expect(repository.loadRuns()).rejects.toThrow('IndexedDB request failed.');
  });

  it('uses fallback transaction error messages when transaction.error is missing', async () => {
    const createTransaction = (mode: 'error' | 'abort', store: IDBObjectStore): IDBTransaction => {
      let oncomplete: IDBTransaction['oncomplete'] = null;
      let onerror: IDBTransaction['onerror'] = null;
      let onabort: IDBTransaction['onabort'] = null;

      const maybeSchedule = () => {
        if (mode === 'error' && onerror) {
          setTimeout(() => {
            onerror?.call(transaction as unknown as IDBTransaction, new Event('error'));
          }, 0);
          return;
        }

        if (mode === 'abort' && onabort) {
          setTimeout(() => {
            onabort?.call(transaction as unknown as IDBTransaction, new Event('abort'));
          }, 0);
          return;
        }

        if (mode === 'error' || mode === 'abort') {
          return;
        }

        if (oncomplete) {
          setTimeout(() => {
            oncomplete?.call(transaction as unknown as IDBTransaction, new Event('complete'));
          }, 0);
        }
      };

      const transaction = {
        error: null,
        objectStore: vi.fn(() => store),
        get oncomplete() {
          return oncomplete;
        },
        set oncomplete(value: IDBTransaction['oncomplete']) {
          oncomplete = value;
          maybeSchedule();
        },
        get onerror() {
          return onerror;
        },
        set onerror(value: IDBTransaction['onerror']) {
          onerror = value;
          maybeSchedule();
        },
        get onabort() {
          return onabort;
        },
        set onabort(value: IDBTransaction['onabort']) {
          onabort = value;
          maybeSchedule();
        },
      };

      return transaction as unknown as IDBTransaction;
    };

    const createIndexedDbFactory = (mode: 'error' | 'abort'): IDBFactory => {
      const store = {
        indexNames: { contains: () => true } as unknown as DOMStringList,
        createIndex: vi.fn(),
        put: vi.fn(),
        clear: vi.fn(),
      } as unknown as IDBObjectStore;

      const database = {
        objectStoreNames: {
          contains: () => true,
        } as unknown as DOMStringList,
        createObjectStore: vi.fn(() => store),
        transaction: vi.fn(() => createTransaction(mode, store)),
        close: vi.fn(),
      } as unknown as IDBDatabase;

      return {
        open: vi.fn(() => {
          const request = {
            result: database,
            transaction: null,
            error: null,
            onupgradeneeded: null as IDBOpenDBRequest['onupgradeneeded'],
            onsuccess: null as IDBOpenDBRequest['onsuccess'],
            onerror: null as IDBOpenDBRequest['onerror'],
          };

          setTimeout(() => {
            request.onsuccess?.call(
              request as unknown as IDBRequest<IDBDatabase>,
              new Event('success'),
            );
          }, 0);

          return request as unknown as IDBOpenDBRequest;
        }),
      } as unknown as IDBFactory;
    };

    const errorRepository = createBenchmarkRepository({
      indexedDBFactory: createIndexedDbFactory('error'),
      logger: { warn: vi.fn() },
    });
    await expect(errorRepository.saveRun(createResult({ id: 'tx-error-null' }))).rejects.toThrow(
      'IndexedDB transaction failed.',
    );

    const abortRepository = createBenchmarkRepository({
      indexedDBFactory: createIndexedDbFactory('abort'),
      logger: { warn: vi.fn() },
    });
    await expect(abortRepository.clearRuns()).rejects.toThrow('IndexedDB transaction was aborted.');
  });
});
