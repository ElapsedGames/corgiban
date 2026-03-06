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

function createOutOfOrderClientMock(): BenchmarkClient {
  return {
    runSuite: vi.fn(
      async (request: {
        runs: BenchmarkClientRunRequest[];
        callbacks?: BenchmarkClientRunCallbacks;
      }) => {
        const firstRun = request.runs[0];
        const secondRun = request.runs[1];
        if (!firstRun || !secondRun) {
          return [];
        }

        request.callbacks?.onDispatch?.(firstRun);
        request.callbacks?.onDispatch?.(secondRun);

        const secondResult = makeResult(secondRun.runId, 2);
        request.callbacks?.onResult?.(secondResult, secondRun);

        const firstResult = makeResult(firstRun.runId, 1);
        request.callbacks?.onResult?.(firstResult, firstRun);

        return [secondResult, firstResult];
      },
    ),
    cancel: vi.fn(() => false),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
    getPoolSize: vi.fn(() => 2),
  };
}

describe('createBenchmarkPort concurrent ordering', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', mocks.workerCtor as unknown as typeof Worker);
    mocks.createBenchmarkClient.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps measured ids and sequences deterministic when results complete out of plan order', async () => {
    const clientMock = createOutOfOrderClientMock();
    mocks.createBenchmarkClient.mockImplementation(() => clientMock);

    const onProgress = vi.fn();
    const onResult = vi.fn();
    const port = createBenchmarkPort({
      concurrency: 2,
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
      suiteRunId: 'bench-concurrent',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 2,
        warmupRepetitions: 0,
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
      onProgress,
      onResult,
    });

    expect(onResult.mock.calls.map(([result]) => result.runId)).toEqual([
      'bench-concurrent-2',
      'bench-concurrent-1',
    ]);
    expect(onResult.mock.calls.map(([result]) => result.sequence)).toEqual([2, 1]);
    expect(results.map((result) => result.runId)).toEqual([
      'bench-concurrent-1',
      'bench-concurrent-2',
    ]);
    expect(results.map((result) => result.sequence)).toEqual([1, 2]);
    expect(results.map((result) => result.id)).toEqual([
      'bench-concurrent:1',
      'bench-concurrent:2',
    ]);
    expect(onProgress.mock.calls.map(([progress]) => progress.completedRuns)).toEqual([1, 2]);

    port.dispose();
  });
});
