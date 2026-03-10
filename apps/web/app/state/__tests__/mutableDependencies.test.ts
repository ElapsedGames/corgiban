import { parseLevel } from '@corgiban/core';
import type { BenchmarkRunRecord } from '@corgiban/benchmarks';
import { describe, expect, it, vi } from 'vitest';

import type { BenchmarkPort, BenchmarkSuiteRunRequest } from '../../ports/benchmarkPort';
import type {
  PersistencePort,
  PersistencePortInitResult,
  RepositoryHealth,
} from '../../ports/persistencePort';
import type {
  SolverPort,
  SolverRunResult,
  StartSolveRequest,
  WorkerHealth,
} from '../../ports/solverPort';
import {
  createMutableBenchmarkPort,
  createMutablePersistencePort,
  createMutableSolverPort,
} from '../mutableDependencies';

const levelRuntime = parseLevel({
  id: 'corgiban-test-18',
  name: 'Classic 1',
  rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
});

const solverRequest: StartSolveRequest = {
  runId: 'solve-1',
  levelRuntime,
  algorithmId: 'bfsPush',
};

const benchmarkRecord: BenchmarkRunRecord = {
  id: 'result-1',
  suiteRunId: 'suite-1',
  runId: 'run-1',
  sequence: 1,
  levelId: 'corgiban-test-18',
  algorithmId: 'bfsPush',
  repetition: 1,
  warmup: false,
  options: {
    timeBudgetMs: 1_000,
    nodeBudget: 5_000,
  },
  status: 'solved',
  solutionMoves: 'R',
  metrics: {
    elapsedMs: 12,
    expanded: 10,
    generated: 12,
    maxDepth: 4,
    maxFrontier: 6,
    pushCount: 2,
    moveCount: 4,
  },
  startedAtMs: 1,
  finishedAtMs: 13,
  environment: {
    userAgent: 'test',
    hardwareConcurrency: 4,
    appVersion: 'test',
  },
  comparableMetadata: {
    solver: {
      algorithmId: 'bfsPush',
      timeBudgetMs: 1_000,
      nodeBudget: 5_000,
    },
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    warmupEnabled: false,
    warmupRepetitions: 0,
  },
};

const benchmarkRequest: BenchmarkSuiteRunRequest = {
  suiteRunId: 'suite-1',
  suite: {
    levelIds: ['corgiban-test-18'],
    algorithmIds: ['bfsPush'],
    repetitions: 1,
    timeBudgetMs: 1_000,
    nodeBudget: 5_000,
  },
  levelResolver: () => levelRuntime,
};

function createSolverRunResult(request: StartSolveRequest): SolverRunResult {
  return {
    runId: request.runId,
    algorithmId: request.algorithmId,
    status: 'solved',
    solutionMoves: 'R',
    metrics: {
      elapsedMs: 12,
      expanded: 10,
      generated: 12,
      maxDepth: 4,
      maxFrontier: 6,
      pushCount: 2,
      moveCount: 4,
    },
  };
}

function createMockSolverPort(initialHealth: WorkerHealth = 'idle') {
  let health = initialHealth;
  const listeners = new Set<(value: WorkerHealth) => void>();
  const unsubscribeSpy = vi.fn();
  const startSolve = vi.fn(async (request: StartSolveRequest) => createSolverRunResult(request));
  const cancelSolve = vi.fn();
  const pingWorker = vi.fn(async () => undefined);
  const retryWorker = vi.fn();
  const getWorkerHealth = vi.fn(() => health);
  const subscribeWorkerHealth = vi.fn((listener: (value: WorkerHealth) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      unsubscribeSpy();
    };
  });
  const dispose = vi.fn();

  const port: SolverPort = {
    startSolve,
    cancelSolve,
    pingWorker,
    retryWorker,
    getWorkerHealth,
    subscribeWorkerHealth,
    dispose,
  };

  return {
    port,
    startSolve,
    cancelSolve,
    pingWorker,
    retryWorker,
    getWorkerHealth,
    subscribeWorkerHealth,
    dispose,
    unsubscribeSpy,
    emitHealth(next: WorkerHealth) {
      health = next;
      listeners.forEach((listener) => {
        listener(next);
      });
    },
  };
}

function createMockBenchmarkPort(results: BenchmarkRunRecord[] = [benchmarkRecord]) {
  const runSuite = vi.fn(async (_request: BenchmarkSuiteRunRequest) => results);
  const cancelSuite = vi.fn();
  const dispose = vi.fn();

  const port: BenchmarkPort = {
    runSuite,
    cancelSuite,
    dispose,
  };

  return {
    port,
    runSuite,
    cancelSuite,
    dispose,
  };
}

function createMockPersistencePort(
  initResult: PersistencePortInitResult = {
    persistOutcome: 'unsupported',
    repositoryHealth: 'unavailable',
  },
  results: BenchmarkRunRecord[] = [benchmarkRecord],
  repositoryHealth: RepositoryHealth = initResult.repositoryHealth,
  lastRepositoryError: string | null = null,
) {
  const init = vi.fn(async () => initResult);
  const loadResults = vi.fn(async () => results);
  const saveResult = vi.fn(async (_result: BenchmarkRunRecord) => undefined);
  const replaceResults = vi.fn(async (_results: BenchmarkRunRecord[]) => undefined);
  const clearResults = vi.fn(async () => undefined);
  const getRepositoryHealth = vi.fn(() => repositoryHealth);
  const getLastRepositoryError = vi.fn(() => lastRepositoryError);
  const dispose = vi.fn();

  const port: PersistencePort = {
    init,
    loadResults,
    saveResult,
    replaceResults,
    clearResults,
    getRepositoryHealth,
    getLastRepositoryError,
    dispose,
  };

  return {
    port,
    init,
    loadResults,
    saveResult,
    replaceResults,
    clearResults,
    getRepositoryHealth,
    getLastRepositoryError,
    dispose,
  };
}

describe('mutableDependencies', () => {
  it('forwards solver operations and rebinds worker-health subscriptions on replace', async () => {
    const initial = createMockSolverPort('idle');
    const next = createMockSolverPort('healthy');
    const proxy = createMutableSolverPort(initial.port);
    const listener = vi.fn();

    const unsubscribe = proxy.subscribeWorkerHealth(listener);

    await expect(proxy.startSolve(solverRequest)).resolves.toMatchObject({
      runId: 'solve-1',
      algorithmId: 'bfsPush',
      status: 'solved',
    });
    proxy.cancelSolve('solve-1');
    await expect(proxy.pingWorker()).resolves.toBeUndefined();
    proxy.retryWorker();
    expect(proxy.getWorkerHealth()).toBe('idle');
    expect(initial.startSolve).toHaveBeenCalledWith(solverRequest);
    expect(initial.cancelSolve).toHaveBeenCalledWith('solve-1');
    expect(initial.pingWorker).toHaveBeenCalledTimes(1);
    expect(initial.retryWorker).toHaveBeenCalledTimes(1);

    initial.emitHealth('healthy');
    expect(listener).toHaveBeenNthCalledWith(1, 'healthy');

    proxy.replace(next.port);

    expect(initial.unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(initial.dispose).toHaveBeenCalledTimes(1);
    expect(next.subscribeWorkerHealth).toHaveBeenCalledTimes(1);
    expect(proxy.getWorkerHealth()).toBe('healthy');
    expect(listener).toHaveBeenNthCalledWith(2, 'healthy');

    next.emitHealth('crashed');
    expect(listener).toHaveBeenNthCalledWith(3, 'crashed');

    unsubscribe();
    expect(next.unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the underlying solver port only after the last listener leaves', () => {
    const initial = createMockSolverPort('idle');
    const next = createMockSolverPort('crashed');
    const proxy = createMutableSolverPort(initial.port);
    const firstListener = vi.fn();
    const secondListener = vi.fn();

    const unsubscribeFirst = proxy.subscribeWorkerHealth(firstListener);
    const unsubscribeSecond = proxy.subscribeWorkerHealth(secondListener);

    expect(initial.subscribeWorkerHealth).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    expect(initial.unsubscribeSpy).not.toHaveBeenCalled();

    unsubscribeSecond();
    expect(initial.unsubscribeSpy).toHaveBeenCalledTimes(1);

    proxy.replace(next.port);
    expect(next.subscribeWorkerHealth).not.toHaveBeenCalled();

    const thirdListener = vi.fn();
    proxy.subscribeWorkerHealth(thirdListener);
    expect(next.subscribeWorkerHealth).toHaveBeenCalledTimes(1);

    next.emitHealth('healthy');
    expect(thirdListener).toHaveBeenCalledWith('healthy');
  });

  it('disposes solver ports exactly once and disposes late replacements immediately', () => {
    const initial = createMockSolverPort('idle');
    const proxy = createMutableSolverPort(initial.port);

    proxy.subscribeWorkerHealth(vi.fn());
    proxy.dispose();
    proxy.dispose();

    expect(initial.unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(initial.dispose).toHaveBeenCalledTimes(1);

    const late = createMockSolverPort('healthy');
    proxy.replace(late.port);
    expect(late.dispose).toHaveBeenCalledTimes(1);
  });

  it('forwards benchmark calls, replaces implementations, and disposes late replacements', async () => {
    const initial = createMockBenchmarkPort([benchmarkRecord]);
    const next = createMockBenchmarkPort([]);
    const proxy = createMutableBenchmarkPort(initial.port);

    await expect(proxy.runSuite(benchmarkRequest)).resolves.toEqual([benchmarkRecord]);
    proxy.cancelSuite('suite-1');
    expect(initial.runSuite).toHaveBeenCalledWith(benchmarkRequest);
    expect(initial.cancelSuite).toHaveBeenCalledWith('suite-1');

    proxy.replace(next.port);
    expect(initial.dispose).toHaveBeenCalledTimes(1);
    await expect(proxy.runSuite(benchmarkRequest)).resolves.toEqual([]);

    proxy.dispose();
    proxy.dispose();
    expect(next.dispose).toHaveBeenCalledTimes(1);

    const late = createMockBenchmarkPort();
    proxy.replace(late.port);
    expect(late.dispose).toHaveBeenCalledTimes(1);
  });

  it('forwards persistence calls, swaps implementations, and disposes late replacements', async () => {
    const initial = createMockPersistencePort(
      {
        persistOutcome: 'granted',
        repositoryHealth: 'durable',
      },
      [benchmarkRecord],
      'durable',
      'disk full',
    );
    const next = createMockPersistencePort(
      {
        persistOutcome: 'denied',
        repositoryHealth: 'memory-fallback',
      },
      [],
      'memory-fallback',
      null,
    );
    const proxy = createMutablePersistencePort(initial.port);

    await expect(proxy.init({ debug: true })).resolves.toEqual({
      persistOutcome: 'granted',
      repositoryHealth: 'durable',
    });
    await expect(proxy.loadResults()).resolves.toEqual([benchmarkRecord]);
    await expect(proxy.saveResult(benchmarkRecord)).resolves.toBeUndefined();
    await expect(proxy.replaceResults([])).resolves.toBeUndefined();
    await expect(proxy.clearResults()).resolves.toBeUndefined();
    expect(proxy.getRepositoryHealth()).toBe('durable');
    expect(proxy.getLastRepositoryError()).toBe('disk full');
    expect(initial.saveResult).toHaveBeenCalledWith(benchmarkRecord);
    expect(initial.replaceResults).toHaveBeenCalledWith([]);

    proxy.replace(next.port);
    expect(initial.dispose).toHaveBeenCalledTimes(1);
    expect(proxy.getRepositoryHealth()).toBe('memory-fallback');
    expect(proxy.getLastRepositoryError()).toBeNull();

    proxy.dispose();
    proxy.dispose();
    expect(next.dispose).toHaveBeenCalledTimes(1);

    const late = createMockPersistencePort();
    proxy.replace(late.port);
    expect(late.dispose).toHaveBeenCalledTimes(1);
  });
});
