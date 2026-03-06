import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BenchmarkClient,
  BenchmarkClientRunCallbacks,
  BenchmarkClientRunRequest,
  BenchResultMessage,
} from '@corgiban/worker';

const mocks = vi.hoisted(() => ({
  createBenchmarkClient: vi.fn(),
  workerCtor: vi.fn(function workerCtor(
    this: {
      onmessage: ((event: unknown) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onmessageerror: ((event: unknown) => void) | null;
      source?: string;
      options?: { type?: 'module'; name?: string };
      postMessage?: () => void;
      terminate?: () => void;
    },
    source: string,
    options?: { type?: 'module'; name?: string },
  ) {
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
    this.source = source;
    this.options = options;
    this.postMessage = () => undefined;
    this.terminate = () => undefined;
  }),
}));

vi.mock('@corgiban/worker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@corgiban/worker')>();
  return {
    ...actual,
    createBenchmarkClient: mocks.createBenchmarkClient,
  };
});

vi.mock('../benchmarkWorker.client.ts?worker&url', () => ({
  default: '/app/ports/benchmarkWorker.client.ts?worker_file&type=module',
}));

import { BenchmarkRunCancelledError } from '../benchmarkPort';
import {
  createBenchmarkPort,
  resolveBenchmarkConcurrency,
  type BenchmarkPortPerformanceApi,
} from '../benchmarkPort.client';

function makeMetrics() {
  return {
    elapsedMs: 15,
    expanded: 12,
    generated: 20,
    maxDepth: 4,
    maxFrontier: 8,
    pushCount: 2,
    moveCount: 6,
  };
}

function makeBenchResult(
  runId: string,
  overrides?: Partial<BenchResultMessage>,
): BenchResultMessage {
  return {
    type: 'BENCH_RESULT',
    runId,
    protocolVersion: 2,
    status: 'solved',
    metrics: makeMetrics(),
    solutionMoves: 'RR',
    ...overrides,
  } as BenchResultMessage;
}

function createClientMock(overrides?: {
  runSuite?: (request: {
    runs: BenchmarkClientRunRequest[];
    callbacks?: BenchmarkClientRunCallbacks;
  }) => Promise<BenchResultMessage[]>;
  cancelSuite?: () => void;
}): BenchmarkClient {
  // Tracks a pending runSuite rejection so dispose/cancelSuite can abort it.
  let abortPending: ((e: Error) => void) | null = null;
  const abortAndClear = () => {
    abortPending?.(new Error('Benchmark suite cancelled.'));
    abortPending = null;
  };

  const defaultRunSuite = vi.fn(
    async (request: {
      runs: BenchmarkClientRunRequest[];
      callbacks?: BenchmarkClientRunCallbacks;
    }) => {
      const results: BenchResultMessage[] = [];
      for (const run of request.runs) {
        request.callbacks?.onDispatch?.(run);
        const result = makeBenchResult(run.runId);
        results.push(result);
        request.callbacks?.onResult?.(result, run);
      }
      return results;
    },
  );

  const overriddenRunSuite = overrides?.runSuite;
  const runSuite = overriddenRunSuite
    ? vi.fn(
        (request: { runs: BenchmarkClientRunRequest[]; callbacks?: BenchmarkClientRunCallbacks }) =>
          new Promise<BenchResultMessage[]>((resolve, reject) => {
            abortPending = reject;
            overriddenRunSuite(request).then(
              (r) => {
                abortPending = null;
                resolve(r);
              },
              (e: unknown) => {
                abortPending = null;
                reject(e as Error);
              },
            );
          }),
      )
    : defaultRunSuite;

  return {
    runSuite,
    cancel: vi.fn(() => false),
    cancelSuite: overrides?.cancelSuite ?? vi.fn(abortAndClear),
    dispose: vi.fn(abortAndClear),
    getPoolSize: vi.fn(() => 1),
  };
}

describe('createBenchmarkPort (client)', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', mocks.workerCtor as unknown as typeof Worker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('runs suite plans through benchmark clients and records performance marks', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const performanceApi = {
      mark: vi.fn(),
      measure: vi.fn(),
    };

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: {
        userAgent: 'BenchTest',
        hardwareConcurrency: 8,
      },
      performanceApi,
      appVersion: 'app-test',
      now: (() => {
        let value = 100;
        return () => {
          value += 10;
          return value;
        };
      })(),
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-1',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(mocks.createBenchmarkClient).toHaveBeenCalledTimes(1);
    expect(mocks.workerCtor).toHaveBeenCalledWith(
      '/app/ports/benchmarkWorker.client.ts?worker_file&type=module',
      { type: 'module', name: 'corgiban-benchmark' },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.algorithmId).toBe('bfsPush');
    expect(results[0]?.options.timeBudgetMs).toBe(1_000);
    expect(results[0]?.environment.userAgent).toBe('BenchTest');
    expect(results[0]?.environment.appVersion).toBe('app-test');

    expect(performanceApi.mark).toHaveBeenCalledWith('bench:solve-dispatch:bench-1-1');
    expect(performanceApi.mark).toHaveBeenCalledWith('bench:solve-response:bench-1-1');
    expect(performanceApi.measure).toHaveBeenCalledWith(
      'bench:solve-roundtrip:bench-1-1',
      'bench:solve-dispatch:bench-1-1',
      'bench:solve-response:bench-1-1',
    );

    port.dispose();
  });

  it('disables spectator stream in worker run options when no worker-progress consumer exists', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-options',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_500,
        nodeBudget: 3_500,
        algorithmOptions: {
          bfsPush: {
            enableSpectatorStream: true,
          },
        },
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    const runSuiteCalls = vi.mocked(clientMock.runSuite).mock.calls;
    expect(runSuiteCalls[0]?.[0].runs[0]?.options).toEqual({
      enableSpectatorStream: false,
      timeBudgetMs: 1_500,
      nodeBudget: 3_500,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.options).toEqual({
      enableSpectatorStream: false,
      timeBudgetMs: 1_500,
      nodeBudget: 3_500,
    });
    expect(results[0]?.comparableMetadata).toEqual({
      solver: {
        algorithmId: 'bfsPush',
        enableSpectatorStream: false,
        timeBudgetMs: 1_500,
        nodeBudget: 3_500,
      },
      environment: {
        userAgent: 'BenchTest',
        hardwareConcurrency: 8,
        appVersion: expect.any(String),
      },
      warmupEnabled: false,
      warmupRepetitions: 0,
    });

    port.dispose();
  });

  it('preserves spectator stream options and forwards BENCH_PROGRESS when worker-progress consumer exists', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const results: BenchResultMessage[] = [];
          for (const run of request.runs) {
            request.callbacks?.onDispatch?.(run);
            request.callbacks?.onProgress?.(
              {
                type: 'BENCH_PROGRESS',
                runId: run.runId,
                protocolVersion: 2,
                expanded: 5,
                generated: 8,
                depth: 2,
                frontier: 3,
                elapsedMs: 5,
                bestPathSoFar: 'R',
              },
              run,
            );
            const result = makeBenchResult(run.runId);
            results.push(result);
            request.callbacks?.onResult?.(result, run);
          }
          return results;
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const onWorkerProgress = vi.fn();
    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-worker-progress',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_500,
        nodeBudget: 3_500,
        algorithmOptions: {
          bfsPush: {
            enableSpectatorStream: true,
          },
        },
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
      onWorkerProgress,
    });

    const runSuiteCalls = vi.mocked(clientMock.runSuite).mock.calls;
    expect(runSuiteCalls[0]?.[0].runs[0]?.options).toEqual({
      enableSpectatorStream: true,
      timeBudgetMs: 1_500,
      nodeBudget: 3_500,
    });
    expect(onWorkerProgress).toHaveBeenCalledTimes(1);
    expect(onWorkerProgress).toHaveBeenCalledWith({
      suiteRunId: 'bench-worker-progress',
      runId: 'bench-worker-progress-1',
      planSequence: 1,
      measuredSequence: 1,
      warmup: false,
      levelId: 'classic-001',
      algorithmId: 'bfsPush',
      repetition: 1,
      expanded: 5,
      generated: 8,
      depth: 2,
      frontier: 3,
      elapsedMs: 5,
      bestPathSoFar: 'R',
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.options).toEqual({
      enableSpectatorStream: true,
      timeBudgetMs: 1_500,
      nodeBudget: 3_500,
    });
    expect(results[0]?.comparableMetadata).toEqual({
      solver: {
        algorithmId: 'bfsPush',
        enableSpectatorStream: true,
        timeBudgetMs: 1_500,
        nodeBudget: 3_500,
      },
      environment: {
        userAgent: 'BenchTest',
        hardwareConcurrency: 8,
        appVersion: expect.any(String),
      },
      warmupEnabled: false,
      warmupRepetitions: 0,
    });

    port.dispose();
  });

  it('cancels an active suite run', async () => {
    let rejectSuite: (e: Error) => void = () => undefined;
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async () =>
          new Promise<BenchResultMessage[]>((_resolve, reject) => {
            rejectSuite = reject;
          }),
      ),
      cancelSuite: vi.fn(() => {
        rejectSuite(new Error('Benchmark suite cancelled.'));
      }),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const runPromise = port.runSuite({
      suiteRunId: 'bench-cancel',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    await Promise.resolve();
    port.cancelSuite('bench-cancel');

    await expect(runPromise).rejects.toMatchObject({
      name: 'BenchmarkRunCancelledError',
    });

    port.dispose();
  });

  it('resolves benchmark concurrency from hardwareConcurrency with clamping', () => {
    expect(resolveBenchmarkConcurrency(undefined)).toBe(3);
    expect(resolveBenchmarkConcurrency({ userAgent: 'x', hardwareConcurrency: 1 })).toBe(1);
    expect(resolveBenchmarkConcurrency({ userAgent: 'x', hardwareConcurrency: 2 })).toBe(1);
    expect(resolveBenchmarkConcurrency({ userAgent: 'x', hardwareConcurrency: 8 })).toBe(4);
    expect(resolveBenchmarkConcurrency({ userAgent: 'x', hardwareConcurrency: -1 })).toBe(3);
  });

  it('clamps manual concurrency override at MAX_POOL_SIZE', async () => {
    const clientMock = createClientMock();
    let capturedPoolSize: number | undefined;
    mocks.createBenchmarkClient.mockImplementation(
      (options?: { createWorker?: () => unknown; poolSize?: number }) => {
        options?.createWorker?.();
        capturedPoolSize = options?.poolSize;
        return clientMock;
      },
    );

    const port = createBenchmarkPort({
      concurrency: 100,
      navigatorLike: { userAgent: 'x', hardwareConcurrency: 8 },
    });

    await port.runSuite({
      suiteRunId: 'bench-cap',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(capturedPoolSize).toBeLessThanOrEqual(4);

    port.dispose();
  });

  it('returns empty results when suite has no run plans', async () => {
    const port = createBenchmarkPort({
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-empty',
        suite: {
          levelIds: [],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1000,
          nodeBudget: 1000,
        },
        levelResolver: () => {
          throw new Error('should not resolve level');
        },
      }),
    ).resolves.toEqual([]);

    port.dispose();
  });

  it('rejects overlapping suites while one is active', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(async () => new Promise<BenchResultMessage[]>(() => undefined)),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const firstRun = port.runSuite({
      suiteRunId: 'bench-1',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-2',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => ({
          levelId: 'classic-001',
          width: 1,
          height: 1,
          staticGrid: new Uint8Array([0]),
          initialPlayerIndex: 0,
          initialBoxes: new Uint32Array([]),
        }),
      }),
    ).rejects.toThrow('already running');

    port.dispose();
    await expect(firstRun).rejects.toBeInstanceOf(BenchmarkRunCancelledError);
  });

  it('maps BENCH_RESULT status=error into benchmark records with error fields', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const results: BenchResultMessage[] = [];
          for (const run of request.runs) {
            const result = makeBenchResult(run.runId, {
              status: 'error',
              errorMessage: 'solver failed',
              errorDetails: 'stack',
            } as Partial<BenchResultMessage>);
            results.push(result);
            request.callbacks?.onResult?.(result, run);
          }
          return results;
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-error',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      status: 'error',
      errorMessage: 'solver failed',
      errorDetails: 'stack',
    });
    port.dispose();
  });

  it('continues suite execution when performance marks throw', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const performanceApi = {
      mark: vi.fn(() => {
        throw new Error('mark failed');
      }),
      measure: vi.fn(() => {
        throw new Error('measure failed');
      }),
    };

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi,
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-mark-fail',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => ({
          levelId: 'classic-001',
          width: 1,
          height: 1,
          staticGrid: new Uint8Array([0]),
          initialPlayerIndex: 0,
          initialBoxes: new Uint32Array([]),
        }),
      }),
    ).resolves.toHaveLength(1);

    expect(performanceApi.mark).toHaveBeenCalled();
    port.dispose();
  });

  it('uses global navigator fallback and defaults environment metadata when unavailable', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    vi.stubGlobal('navigator', {});

    const port = createBenchmarkPort({
      concurrency: 1,
      performanceApi: null as unknown as never,
      appVersion: 'app-fallback',
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-fallback-env',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.environment).toEqual({
      userAgent: 'unknown',
      hardwareConcurrency: 4,
      appVersion: 'app-fallback',
    });

    port.dispose();
  });

  it('uses a non-web default appVersion when no override is provided', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: {
        userAgent: 'BenchTest',
        hardwareConcurrency: 8,
      },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-default-app-version',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.environment.appVersion).toBeTruthy();
    expect(results[0]?.environment.appVersion).not.toBe('web');

    port.dispose();
  });

  it('runs suites when global performance APIs are unavailable', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    vi.stubGlobal('performance', undefined as never);

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-no-performance',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => ({
          levelId: 'classic-001',
          width: 1,
          height: 1,
          staticGrid: new Uint8Array([0]),
          initialPlayerIndex: 0,
          initialBoxes: new Uint32Array([]),
        }),
      }),
    ).resolves.toHaveLength(1);

    port.dispose();
  });

  it('rejects when level resolution throws', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-level-error',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => {
          throw new Error('missing level runtime');
        },
      }),
    ).rejects.toThrow('missing level runtime');

    port.dispose();
  });

  it('clears activeSuite after levelResolver throws so a subsequent runSuite succeeds', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    // First call: levelResolver throws - should reject and unlock the port.
    await expect(
      port.runSuite({
        suiteRunId: 'bench-level-error-lock',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => {
          throw new Error('missing level runtime');
        },
      }),
    ).rejects.toThrow('missing level runtime');

    // Second call: should not throw "already running" because activeSuite was cleared.
    await expect(
      port.runSuite({
        suiteRunId: 'bench-level-error-retry',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => ({
          levelId: 'classic-001',
          width: 1,
          height: 1,
          staticGrid: new Uint8Array([0]),
          initialPlayerIndex: 0,
          initialBoxes: new Uint32Array([]),
        }),
      }),
    ).resolves.toHaveLength(1);

    port.dispose();
  });

  it('maps error status without optional error details', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const results: BenchResultMessage[] = [];
          for (const run of request.runs) {
            const result = makeBenchResult(run.runId, {
              status: 'error',
              errorMessage: 'solver failed',
            } as Partial<BenchResultMessage>);
            results.push(result);
            request.callbacks?.onResult?.(result, run);
          }
          return results;
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-error-no-details',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'error', errorMessage: 'solver failed' });
    expect('errorDetails' in (results[0] ?? {})).toBe(false);
    port.dispose();
  });

  it('maps non-error statuses without optional solution moves', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const results: BenchResultMessage[] = [];
          for (const run of request.runs) {
            const result: BenchResultMessage = {
              type: 'BENCH_RESULT',
              runId: run.runId,
              protocolVersion: 2,
              status: 'unsolved',
              metrics: makeMetrics(),
            };
            results.push(result);
            request.callbacks?.onResult?.(result, run);
          }
          return results;
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const onResult = vi.fn();
    const onProgress = vi.fn();

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-unsolved-no-solution',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
      onResult,
      onProgress,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'unsolved' });
    expect('solutionMoves' in (results[0] ?? {})).toBe(false);

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({
      suiteRunId: 'bench-unsolved-no-solution',
      totalRuns: 1,
      completedRuns: 1,
      latestResultId: expect.any(String),
    });

    port.dispose();
  });

  it('does nothing when cancelling a non-active suite run id', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    port.cancelSuite('unknown-suite');

    await expect(
      port.runSuite({
        suiteRunId: 'bench-normal',
        suite: {
          levelIds: ['classic-001'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => ({
          levelId: 'classic-001',
          width: 1,
          height: 1,
          staticGrid: new Uint8Array([0]),
          initialPlayerIndex: 0,
          initialBoxes: new Uint32Array([]),
        }),
      }),
    ).resolves.toHaveLength(1);

    port.dispose();
  });

  it('records dispatch mark on dispatch callback and response mark on result', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const results: BenchResultMessage[] = [];
          for (const run of request.runs) {
            request.callbacks?.onDispatch?.(run);
            request.callbacks?.onProgress?.(
              {
                type: 'BENCH_PROGRESS',
                runId: run.runId,
                protocolVersion: 2,
                expanded: 5,
                generated: 8,
                depth: 2,
                frontier: 3,
                elapsedMs: 5,
              },
              run,
            );
            const result = makeBenchResult(run.runId);
            results.push(result);
            request.callbacks?.onResult?.(result, run);
          }
          return results;
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const markCalls: string[] = [];
    const performanceApi = {
      mark: vi.fn((name: string) => {
        markCalls.push(name);
      }),
      measure: vi.fn(),
    } as unknown as BenchmarkPortPerformanceApi;

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'x', hardwareConcurrency: 4 },
      performanceApi,
    });

    await port.runSuite({
      suiteRunId: 'bench-progress',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    // Dispatch mark comes first (from onDispatch), response mark comes after (from onResult).
    expect(markCalls[0]).toBe('bench:solve-dispatch:bench-progress-1');
    expect(markCalls[1]).toBe('bench:solve-response:bench-progress-1');

    port.dispose();
  });

  it('records startedAtMs from dispatch timing for queued runs without progress', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const firstRun = request.runs[0];
          const secondRun = request.runs[1];
          if (!firstRun || !secondRun) {
            throw new Error('Expected two queued runs.');
          }

          const firstResult = makeBenchResult(firstRun.runId);
          request.callbacks?.onDispatch?.(firstRun);
          request.callbacks?.onResult?.(firstResult, firstRun);

          const secondResult = makeBenchResult(secondRun.runId);
          request.callbacks?.onDispatch?.(secondRun);
          request.callbacks?.onResult?.(secondResult, secondRun);

          return [firstResult, secondResult];
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'queue-test', hardwareConcurrency: 4 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
      now: (() => {
        let value = 0;
        return () => {
          value += 10;
          return value;
        };
      })(),
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-queued',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 2,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.runId).toBe('bench-queued-1');
    expect(results[1]?.runId).toBe('bench-queued-2');
    expect(results[0]?.startedAtMs).toBe(10);
    expect(results[1]?.startedAtMs).toBe(30);
    expect(results[0]?.startedAtMs).toBeLessThan(results[1]?.startedAtMs ?? 0);

    port.dispose();
  });

  it('throws cancellation error when suite is cancelled before a successful client completion', async () => {
    const suiteResolution: { resolve: (() => void) | null } = { resolve: null };
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) =>
          new Promise<BenchResultMessage[]>((resolve) => {
            suiteResolution.resolve = () => {
              const results = request.runs.map((run) => {
                request.callbacks?.onDispatch?.(run);
                const result = makeBenchResult(run.runId);
                request.callbacks?.onResult?.(result, run);
                return result;
              });
              resolve(results);
            };
          }),
      ),
      cancelSuite: vi.fn(() => undefined),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const runPromise = port.runSuite({
      suiteRunId: 'bench-cancel-resolve',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    await Promise.resolve();
    port.cancelSuite('bench-cancel-resolve');
    if (typeof suiteResolution.resolve === 'function') {
      suiteResolution.resolve();
    }

    await expect(runPromise).rejects.toBeInstanceOf(BenchmarkRunCancelledError);
    port.dispose();
  });

  it('ignores unknown run ids in worker progress and result callbacks', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const firstRun = request.runs[0];
          if (!firstRun) {
            throw new Error('Expected at least one run.');
          }

          const unknownRunRequest = { ...firstRun, runId: 'unknown-run-id' };

          request.callbacks?.onProgress?.(
            {
              type: 'BENCH_PROGRESS',
              runId: 'unknown-run-id',
              protocolVersion: 2,
              expanded: 1,
              generated: 2,
              depth: 0,
              frontier: 0,
              elapsedMs: 3,
              bestHeuristic: 2,
            },
            unknownRunRequest,
          );
          request.callbacks?.onResult?.(makeBenchResult('unknown-run-id'), unknownRunRequest);

          request.callbacks?.onDispatch?.(firstRun);
          request.callbacks?.onProgress?.(
            {
              type: 'BENCH_PROGRESS',
              runId: firstRun.runId,
              protocolVersion: 2,
              expanded: 5,
              generated: 8,
              depth: 2,
              frontier: 3,
              elapsedMs: 9,
              bestHeuristic: 4,
            },
            firstRun,
          );
          const result = makeBenchResult(firstRun.runId);
          request.callbacks?.onResult?.(result, firstRun);
          return [result];
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const onWorkerProgress = vi.fn();
    const onResult = vi.fn();
    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-ignore-unknown-run',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
      onWorkerProgress,
      onResult,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.runId).toBe('bench-ignore-unknown-run-1');
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'bench-ignore-unknown-run-1' }),
    );
    expect(onWorkerProgress).toHaveBeenCalledTimes(1);
    expect(onWorkerProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'bench-ignore-unknown-run-1',
        bestHeuristic: 4,
      }),
    );

    port.dispose();
  });

  it('uses plan options when result callbacks omit runRequest options', async () => {
    const clientMock = createClientMock({
      runSuite: vi.fn(
        async (request: {
          runs: BenchmarkClientRunRequest[];
          callbacks?: BenchmarkClientRunCallbacks;
        }) => {
          const run = request.runs[0];
          if (!run) {
            throw new Error('Expected one run.');
          }

          request.callbacks?.onDispatch?.(run);
          const result = makeBenchResult(run.runId);
          request.callbacks?.onResult?.(result, { ...run, options: undefined });
          return [result];
        },
      ),
    });

    mocks.createBenchmarkClient.mockImplementation((options?: { createWorker?: () => unknown }) => {
      options?.createWorker?.();
      return clientMock;
    });

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const results = await port.runSuite({
      suiteRunId: 'bench-options-fallback',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_234,
        nodeBudget: 5_678,
        algorithmOptions: {
          bfsPush: {
            enableSpectatorStream: true,
          },
        },
      },
      levelResolver: () => ({
        levelId: 'classic-001',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.options).toEqual({
      enableSpectatorStream: true,
      timeBudgetMs: 1_234,
      nodeBudget: 5_678,
    });

    port.dispose();
  });
});
