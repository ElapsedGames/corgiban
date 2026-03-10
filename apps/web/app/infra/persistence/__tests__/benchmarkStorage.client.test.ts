import { describe, expect, it, vi } from 'vitest';

import type { BenchmarkRunRecord } from '@corgiban/benchmarks';

import type { BenchmarkRepository } from '../benchmarkRepository.client';
import { createBenchmarkStorage, createNoopBenchmarkStorage } from '../benchmarkStorage.client';
import { applyRetentionLimit, sortByCompletion, upsertMemoryResult } from '../benchmarkStorage';

function createResult(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'bench-1',
    runId: 'bench-1-1',
    sequence: 1,
    levelId: 'corgiban-test-18',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1000,
      nodeBudget: 500,
    },
    status: 'unsolved',
    metrics: {
      elapsedMs: 20,
      expanded: 5,
      generated: 7,
      maxDepth: 2,
      maxFrontier: 3,
      pushCount: 1,
      moveCount: 2,
    },
    startedAtMs: 10,
    finishedAtMs: 30,
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    ...overrides,
  };
}

function createRepositoryMock(initialResults: BenchmarkRunRecord[] = []) {
  const state = [...initialResults];

  const repository: BenchmarkRepository = {
    loadRuns: vi.fn(async () => {
      return [...state];
    }),
    saveRun: vi.fn(async (result: BenchmarkRunRecord) => {
      const existingIndex = state.findIndex((entry) => entry.id === result.id);
      if (existingIndex >= 0) {
        state[existingIndex] = result;
        return;
      }
      state.push(result);
    }),
    replaceRuns: vi.fn(async (results: BenchmarkRunRecord[]) => {
      state.length = 0;
      state.push(...results);
    }),
    clearRuns: vi.fn(async () => {
      state.length = 0;
    }),
    deleteRuns: vi.fn(async (runIds: string[]) => {
      const runIdSet = new Set(runIds);
      const retained = state.filter((result) => !runIdSet.has(result.id));
      state.length = 0;
      state.push(...retained);
    }),
    dispose: vi.fn(),
  };

  return {
    repository,
    state,
  };
}

describe('benchmarkStorage.client', () => {
  it('returns unsupported persistence when navigator.storage.persist is unavailable', async () => {
    const storage = createBenchmarkStorage({
      repository: null,
      navigatorLike: {},
      isDev: true,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'unavailable',
    });
    expect(storage.getRepositoryHealth()).toBe('unavailable');
    expect(storage.getLastRepositoryError()).toBeNull();

    storage.dispose();
  });

  it('records granted persistence and logs only in dev+debug', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository: null,
      navigatorLike: {
        storage: {
          persist: vi.fn(async () => true),
        },
      },
      isDev: true,
      logger,
    });

    await expect(storage.init({ debug: true })).resolves.toEqual({
      persistOutcome: 'granted',
      repositoryHealth: 'unavailable',
    });
    expect(logger.info).toHaveBeenCalledTimes(1);

    await storage.init({ debug: false });
    expect(logger.info).toHaveBeenCalledTimes(1);

    storage.dispose();
  });

  it('records denied persistence when persist() resolves false or throws', async () => {
    const deniedStorage = createBenchmarkStorage({
      repository: null,
      navigatorLike: {
        storage: {
          persist: vi.fn(async () => false),
        },
      },
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    await expect(deniedStorage.init()).resolves.toEqual({
      persistOutcome: 'denied',
      repositoryHealth: 'unavailable',
    });

    const thrownStorage = createBenchmarkStorage({
      repository: null,
      navigatorLike: {
        storage: {
          persist: vi.fn(async () => {
            throw new Error('persist failed');
          }),
        },
      },
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    await expect(thrownStorage.init()).resolves.toEqual({
      persistOutcome: 'denied',
      repositoryHealth: 'unavailable',
    });

    deniedStorage.dispose();
    thrownStorage.dispose();
  });

  it('enforces retention when saving and clears storage state', async () => {
    const { repository } = createRepositoryMock();

    const storage = createBenchmarkStorage({
      repository,
      retentionLimit: 2,
      navigatorLike: {},
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    const resultA = createResult({ id: 'result-a', startedAtMs: 1, finishedAtMs: 10 });
    const resultB = createResult({ id: 'result-b', startedAtMs: 2, finishedAtMs: 20 });
    const resultC = createResult({ id: 'result-c', startedAtMs: 3, finishedAtMs: 30 });

    await storage.saveResult(resultA);
    await storage.saveResult(resultB);
    await storage.saveResult(resultC);

    expect(await storage.loadResults()).toEqual([resultB, resultC]);
    expect(repository.deleteRuns).toHaveBeenCalledWith(['result-a']);
    expect(storage.getRepositoryHealth()).toBe('durable');
    expect(storage.getLastRepositoryError()).toBeNull();

    await storage.clearResults();
    expect(await storage.loadResults()).toEqual([]);
    expect(repository.clearRuns).toHaveBeenCalledTimes(1);

    storage.dispose();
  });

  it('applies retention to replaceResults before writing to repository', async () => {
    const { repository } = createRepositoryMock();

    const storage = createBenchmarkStorage({
      repository,
      retentionLimit: 2,
      navigatorLike: {},
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    const resultA = createResult({ id: 'result-a', startedAtMs: 1, finishedAtMs: 10 });
    const resultB = createResult({ id: 'result-b', startedAtMs: 2, finishedAtMs: 20 });
    const resultC = createResult({ id: 'result-c', startedAtMs: 3, finishedAtMs: 30 });

    await storage.replaceResults([resultA, resultB, resultC]);

    expect(await storage.loadResults()).toEqual([resultB, resultC]);
    expect(repository.replaceRuns).toHaveBeenCalledWith([resultB, resultC]);

    storage.dispose();
  });

  it('does not emit diagnostics logs outside dev mode', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository: null,
      navigatorLike: {
        storage: {
          persist: vi.fn(async () => true),
        },
      },
      isDev: false,
      logger,
    });

    await expect(storage.init({ debug: true })).resolves.toEqual({
      persistOutcome: 'granted',
      repositoryHealth: 'unavailable',
    });
    expect(logger.info).not.toHaveBeenCalled();
    storage.dispose();
  });

  it('continues initialization when repository load fails', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => {
        throw new Error('load failed');
      }),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'memory-fallback',
    });
    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('load failed');
    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to initialize benchmark repository.',
      expect.any(Error),
    );
    storage.dispose();
  });

  it('keeps memory writes when repository save/replace/clear operations fail', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => {
        throw new Error('load failed');
      }),
      saveRun: vi.fn(async () => {
        throw new Error('save failed');
      }),
      replaceRuns: vi.fn(async () => {
        throw new Error('replace failed');
      }),
      clearRuns: vi.fn(async () => {
        throw new Error('clear failed');
      }),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      retentionLimit: 2,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    const result = createResult({ id: 'result-save-failure', finishedAtMs: 99, startedAtMs: 88 });
    await expect(storage.saveResult(result)).rejects.toThrow('save failed');
    expect(await storage.loadResults()).toEqual([result]);

    const replaceResult = createResult({
      id: 'replace-result',
      finishedAtMs: 120,
      startedAtMs: 119,
    });
    await expect(storage.replaceResults([replaceResult])).resolves.toBeUndefined();
    expect(await storage.loadResults()).toEqual([replaceResult]);

    await expect(storage.clearResults()).resolves.toBeUndefined();
    expect(await storage.loadResults()).toEqual([]);
    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('save failed');

    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to persist benchmark result.',
      expect.any(Error),
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    storage.dispose();
  });

  it('uses default retention when retentionLimit is invalid', async () => {
    const storage = createBenchmarkStorage({
      repository: null,
      retentionLimit: 0,
      navigatorLike: {},
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    const runs = Array.from({ length: 3 }).map((_, index) =>
      createResult({
        id: `result-${index}`,
        startedAtMs: index,
        finishedAtMs: index + 10,
      }),
    );

    await storage.replaceResults(runs);
    await expect(storage.loadResults()).resolves.toHaveLength(3);
    storage.dispose();
  });

  it('updates existing in-memory results when saving the same id twice', async () => {
    const storage = createBenchmarkStorage({
      repository: null,
      navigatorLike: {},
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    const first = createResult({ id: 'same-id', finishedAtMs: 20, startedAtMs: 10 });
    const updated = createResult({
      id: 'same-id',
      finishedAtMs: 20,
      startedAtMs: 11,
      metrics: { ...first.metrics, elapsedMs: 999 },
    });

    await storage.saveResult(first);
    await storage.saveResult(updated);

    await expect(storage.loadResults()).resolves.toEqual([updated]);
    storage.dispose();
  });

  it('applies deterministic tie-breakers for equal finishedAtMs during retention', async () => {
    const storage = createBenchmarkStorage({
      repository: null,
      retentionLimit: 1,
      navigatorLike: {},
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    const olderStart = createResult({ id: 'older', finishedAtMs: 30, startedAtMs: 10 });
    const newerStart = createResult({ id: 'newer', finishedAtMs: 30, startedAtMs: 20 });

    await storage.replaceResults([olderStart, newerStart]);

    await expect(storage.loadResults()).resolves.toEqual([newerStart]);
    storage.dispose();
  });

  it('deletes retained-overflow records during repository sync on init', async () => {
    const resultA = createResult({ id: 'a', finishedAtMs: 10, startedAtMs: 1 });
    const resultB = createResult({ id: 'b', finishedAtMs: 20, startedAtMs: 2 });
    const resultC = createResult({ id: 'c', finishedAtMs: 30, startedAtMs: 3 });
    const { repository } = createRepositoryMock([resultA, resultB, resultC]);

    const storage = createBenchmarkStorage({
      repository,
      retentionLimit: 2,
      navigatorLike: {},
      isDev: false,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    });

    await storage.init();

    expect(repository.deleteRuns).toHaveBeenCalledWith(['a']);
    await expect(storage.loadResults()).resolves.toEqual([resultB, resultC]);
    storage.dispose();
  });

  it('keeps loaded retained results in memory when init retention delete fails', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const resultA = createResult({ id: 'a', finishedAtMs: 10, startedAtMs: 1 });
    const resultB = createResult({ id: 'b', finishedAtMs: 20, startedAtMs: 2 });
    const resultC = createResult({ id: 'c', finishedAtMs: 30, startedAtMs: 3 });

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => [resultA, resultB, resultC]),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async () => {
        throw new Error('delete failed');
      }),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      retentionLimit: 2,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'memory-fallback',
    });

    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('delete failed');
    await expect(storage.loadResults()).resolves.toEqual([resultB, resultC]);
    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to initialize benchmark repository.',
      expect.any(Error),
    );

    storage.dispose();
  });

  it('syncs repository results during init before sticky fallback is activated', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const persisted = createResult({ id: 'persisted', startedAtMs: 1, finishedAtMs: 10 });

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => [persisted]),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'durable',
    });

    expect(storage.getRepositoryHealth()).toBe('durable');
    expect(storage.getLastRepositoryError()).toBeNull();
    await expect(storage.loadResults()).resolves.toEqual([persisted]);

    storage.dispose();
  });

  it('keeps in-memory fallback results when init is called again after degraded mode begins', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const persisted = createResult({ id: 'persisted', startedAtMs: 1, finishedAtMs: 10 });
    let loadAttempt = 0;

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => {
        loadAttempt += 1;
        if (loadAttempt === 1) {
          throw new Error('init failed');
        }
        return [persisted];
      }),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'memory-fallback',
    });

    const inMemoryOnly = createResult({ id: 'memory-only', startedAtMs: 2, finishedAtMs: 20 });
    await expect(storage.saveResult(inMemoryOnly)).resolves.toBeUndefined();

    expect(repository.saveRun).not.toHaveBeenCalled();

    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'memory-fallback',
    });

    expect(repository.loadRuns).toHaveBeenCalledTimes(1);
    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('init failed');
    await expect(storage.loadResults()).resolves.toEqual([inMemoryOnly]);
    expect(repository.loadRuns).toHaveBeenCalledTimes(1);

    storage.dispose();
  });

  it('falls back to in-memory results when a later repository load throws a string', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const persisted = createResult({ id: 'persisted', startedAtMs: 1, finishedAtMs: 10 });
    let loadAttempt = 0;

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => {
        loadAttempt += 1;
        if (loadAttempt === 1) {
          return [persisted];
        }
        throw 'load later failed';
      }),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await storage.init();

    await expect(storage.loadResults()).resolves.toEqual([persisted]);
    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('load later failed');
    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to load benchmark runs from repository.',
      'load later failed',
    );

    storage.dispose();
  });

  it('keeps loaded retained results in memory when loadResults retention delete fails', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const resultA = createResult({ id: 'a', finishedAtMs: 10, startedAtMs: 1 });
    const resultB = createResult({ id: 'b', finishedAtMs: 20, startedAtMs: 2 });
    const resultC = createResult({ id: 'c', finishedAtMs: 30, startedAtMs: 3 });
    let loadAttempt = 0;

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => {
        loadAttempt += 1;
        if (loadAttempt === 1) {
          return [resultC];
        }
        return [resultA, resultB, resultC];
      }),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async (runIds: string[]) => {
        if (runIds.length > 0) {
          throw new Error('delete failed');
        }
      }),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      retentionLimit: 2,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await storage.init();

    await expect(storage.loadResults()).resolves.toEqual([resultB, resultC]);
    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('delete failed');
    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to load benchmark runs from repository.',
      expect.any(Error),
    );

    storage.dispose();
  });

  it('records a fallback message when replaceResults throws a non-Error value', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const persisted = createResult({ id: 'persisted', startedAtMs: 1, finishedAtMs: 10 });

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => [persisted]),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => {
        throw {};
      }),
      clearRuns: vi.fn(async () => undefined),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await storage.init();

    const replacement = createResult({ id: 'replacement', startedAtMs: 11, finishedAtMs: 12 });
    await expect(storage.replaceResults([replacement])).rejects.toEqual({});

    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe(
      'Failed to replace benchmark results in repository.',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to replace benchmark results in repository.',
      {},
    );

    storage.dispose();
  });

  it('records clear failures after a successful repository-backed init', async () => {
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    const persisted = createResult({ id: 'persisted', startedAtMs: 1, finishedAtMs: 10 });

    const repository: BenchmarkRepository = {
      loadRuns: vi.fn(async () => [persisted]),
      saveRun: vi.fn(async () => undefined),
      replaceRuns: vi.fn(async () => undefined),
      clearRuns: vi.fn(async () => {
        throw new Error('clear later failed');
      }),
      deleteRuns: vi.fn(async () => undefined),
      dispose: vi.fn(),
    };

    const storage = createBenchmarkStorage({
      repository,
      navigatorLike: {},
      isDev: false,
      logger,
    });

    await storage.init();

    await expect(storage.clearResults()).rejects.toThrow('clear later failed');
    expect(storage.getRepositoryHealth()).toBe('memory-fallback');
    expect(storage.getLastRepositoryError()).toBe('clear later failed');
    expect(logger.warn).toHaveBeenCalledWith(
      '[bench] Failed to clear benchmark results in repository.',
      expect.any(Error),
    );

    storage.dispose();
  });

  it('can initialize with default options and continue without repository-backed writes', async () => {
    const storage = createBenchmarkStorage();

    await expect(storage.init()).resolves.toMatchObject({
      persistOutcome: 'unsupported',
      repositoryHealth: expect.any(String),
    });
    await expect(
      storage.saveResult(createResult({ id: 'default-write', finishedAtMs: 41, startedAtMs: 40 })),
    ).resolves.toBeUndefined();
    await expect(storage.clearResults()).resolves.toBeUndefined();
    await expect(storage.loadResults()).resolves.toEqual([]);
    storage.dispose();
  });

  it('createNoopBenchmarkStorage supports in-memory lifecycle operations', async () => {
    const storage = createNoopBenchmarkStorage();
    await expect(storage.init()).resolves.toEqual({
      persistOutcome: 'unsupported',
      repositoryHealth: 'unavailable',
    });

    const resultA = createResult({ id: 'a', startedAtMs: 1, finishedAtMs: 20 });
    const resultB = createResult({ id: 'b', startedAtMs: 2, finishedAtMs: 10 });

    await storage.saveResult(resultA);
    await storage.saveResult(resultB);
    await expect(storage.loadResults()).resolves.toEqual([resultB, resultA]);

    await storage.replaceResults([resultA]);
    await expect(storage.loadResults()).resolves.toEqual([resultA]);

    await storage.clearResults();
    await expect(storage.loadResults()).resolves.toEqual([]);
    storage.dispose();
  });
});

describe('benchmarkStorage helpers', () => {
  it('sortByCompletion applies startedAt and id tie-breakers deterministically', () => {
    const sameFinishLaterStart = createResult({
      id: 'b-id',
      startedAtMs: 20,
      finishedAtMs: 100,
    });
    const sameFinishEarlierStart = createResult({
      id: 'c-id',
      startedAtMs: 10,
      finishedAtMs: 100,
    });
    const sameFinishAndStartLowerId = createResult({
      id: 'a-id',
      startedAtMs: 20,
      finishedAtMs: 100,
    });

    const sorted = sortByCompletion([
      sameFinishLaterStart,
      sameFinishEarlierStart,
      sameFinishAndStartLowerId,
    ]);

    expect(sorted.map((entry) => entry.id)).toEqual(['c-id', 'a-id', 'b-id']);
  });

  it('applyRetentionLimit keeps newer startedAt entries when finishedAt is tied', () => {
    const older = createResult({ id: 'older', startedAtMs: 10, finishedAtMs: 200 });
    const newer = createResult({ id: 'newer', startedAtMs: 20, finishedAtMs: 200 });

    const retention = applyRetentionLimit([older, newer], 1);

    expect(retention.retainedResults.map((entry) => entry.id)).toEqual(['newer']);
    expect(retention.droppedIds).toEqual(['older']);
  });

  it('applyRetentionLimit uses id tie-breakers when timestamps are equal', () => {
    const higherId = createResult({ id: 'z-id', startedAtMs: 30, finishedAtMs: 300 });
    const lowerId = createResult({ id: 'a-id', startedAtMs: 30, finishedAtMs: 300 });

    const retention = applyRetentionLimit([higherId, lowerId], 1);

    expect(retention.retainedResults.map((entry) => entry.id)).toEqual(['a-id']);
    expect(retention.droppedIds).toEqual(['z-id']);
  });

  it('upsertMemoryResult appends when id is missing', () => {
    const results: BenchmarkRunRecord[] = [];
    const first = createResult({ id: 'new-id' });

    upsertMemoryResult(results, first);

    expect(results).toEqual([first]);
  });

  it('upsertMemoryResult replaces existing entries by id without growing the array', () => {
    const original = createResult({ id: 'same-id', metrics: createResult().metrics });
    const updated = createResult({
      id: 'same-id',
      metrics: { ...createResult().metrics, elapsedMs: 999 },
    });
    const results: BenchmarkRunRecord[] = [original];

    upsertMemoryResult(results, updated);

    expect(results).toEqual([updated]);
    expect(results).toHaveLength(1);
  });
});
