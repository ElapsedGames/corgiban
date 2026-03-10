import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BenchmarkClient,
  BenchmarkClientRunCallbacks,
  BenchmarkClientRunRequest,
  BenchProgressMessage,
  BenchResultMessage,
} from '@corgiban/worker';

const mocks = vi.hoisted(() => ({
  createBenchmarkClient: vi.fn(),
  workerCtor: vi.fn(function workerCtor(
    this: {
      onmessage: ((event: unknown) => void) | null;
      onerror: ((event: unknown) => void) | null;
      onmessageerror: ((event: unknown) => void) | null;
      options?: { name?: string };
      postMessage?: () => void;
      terminate?: () => void;
    },
    options?: { name?: string },
  ) {
    this.onmessage = null;
    this.onerror = null;
    this.onmessageerror = null;
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

import { createBenchmarkPort } from '../benchmarkPort.client';

function makeMetrics(seed: number) {
  return {
    elapsedMs: seed,
    expanded: seed + 1,
    generated: seed + 2,
    maxDepth: seed + 3,
    maxFrontier: seed + 4,
    pushCount: seed + 5,
    moveCount: seed + 6,
  };
}

function makeResult(runId: string, seed: number): BenchResultMessage {
  return {
    type: 'BENCH_RESULT',
    runId,
    protocolVersion: 2,
    status: 'unsolved',
    metrics: makeMetrics(seed),
  };
}

function makeProgress(runId: string, seed: number): BenchProgressMessage {
  return {
    type: 'BENCH_PROGRESS',
    runId,
    protocolVersion: 2,
    expanded: seed + 1,
    generated: seed + 2,
    depth: seed + 3,
    frontier: seed + 4,
    elapsedMs: seed + 5,
  };
}

function createClientMock(): BenchmarkClient {
  return {
    runSuite: vi.fn(
      async (request: {
        runs: BenchmarkClientRunRequest[];
        callbacks?: BenchmarkClientRunCallbacks;
      }) => {
        const results: BenchResultMessage[] = [];

        request.runs.forEach((runRequest, index) => {
          request.callbacks?.onDispatch?.(runRequest);
          request.callbacks?.onProgress?.(makeProgress(runRequest.runId, index), runRequest);
          const result = makeResult(runRequest.runId, index + 1);
          results.push(result);
          request.callbacks?.onResult?.(result, runRequest);
        });

        return results;
      },
    ),
    cancel: vi.fn(() => false),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
    getPoolSize: vi.fn(() => 1),
  };
}

describe('createBenchmarkPort warmup sequencing', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', mocks.workerCtor as unknown as typeof Worker);
    mocks.createBenchmarkClient.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps measured record ids and sequence values contiguous when warmups are present', async () => {
    const clientMock = createClientMock();
    mocks.createBenchmarkClient.mockImplementation(() => clientMock);

    const onProgress = vi.fn();
    const onResult = vi.fn();
    const onWorkerProgress = vi.fn();
    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
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
      suiteRunId: 'bench-warmups',
      suite: {
        levelIds: ['corgiban-test-18'],
        algorithmIds: ['bfsPush'],
        repetitions: 2,
        warmupRepetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => ({
        levelId: 'corgiban-test-18',
        width: 1,
        height: 1,
        staticGrid: new Uint8Array([0]),
        initialPlayerIndex: 0,
        initialBoxes: new Uint32Array([]),
      }),
      onProgress,
      onResult,
      onWorkerProgress,
    });

    expect(results.map((result) => result.runId)).toEqual(['bench-warmups-2', 'bench-warmups-3']);
    expect(results.map((result) => result.sequence)).toEqual([1, 2]);
    expect(results.map((result) => result.id)).toEqual(['bench-warmups:1', 'bench-warmups:2']);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls.map(([progress]) => progress.latestResultId)).toEqual([
      'bench-warmups:1',
      'bench-warmups:2',
    ]);
    expect(onWorkerProgress.mock.calls.map(([progress]) => progress)).toEqual([
      expect.objectContaining({
        runId: 'bench-warmups-1',
        planSequence: 1,
        measuredSequence: null,
        warmup: true,
      }),
      expect.objectContaining({
        runId: 'bench-warmups-2',
        planSequence: 2,
        measuredSequence: 1,
        warmup: false,
      }),
      expect.objectContaining({
        runId: 'bench-warmups-3',
        planSequence: 3,
        measuredSequence: 2,
        warmup: false,
      }),
    ]);

    port.dispose();
  });
});
