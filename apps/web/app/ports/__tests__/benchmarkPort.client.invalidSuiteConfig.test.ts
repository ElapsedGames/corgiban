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

import type { BenchmarkSuiteConfig } from '../benchmarkPort';
import { createBenchmarkPort } from '../benchmarkPort.client';

function createLevelRuntime() {
  return {
    levelId: 'corgiban-test-18',
    width: 1,
    height: 1,
    staticGrid: new Uint8Array([0]),
    initialPlayerIndex: 0,
    initialBoxes: new Uint32Array([]),
  };
}

function makeBenchResult(runId: string): BenchResultMessage {
  return {
    type: 'BENCH_RESULT',
    runId,
    protocolVersion: 2,
    status: 'solved',
    metrics: {
      elapsedMs: 15,
      expanded: 12,
      generated: 20,
      maxDepth: 4,
      maxFrontier: 8,
      pushCount: 2,
      moveCount: 6,
    },
    solutionMoves: 'RR',
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

        for (const run of request.runs) {
          request.callbacks?.onDispatch?.(run);
          const result = makeBenchResult(run.runId);
          results.push(result);
          request.callbacks?.onResult?.(result, run);
        }

        return results;
      },
    ),
    cancel: vi.fn(() => false),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
    getPoolSize: vi.fn(() => 1),
  };
}

const validSuite: BenchmarkSuiteConfig = {
  levelIds: ['corgiban-test-18'],
  algorithmIds: ['bfsPush'],
  repetitions: 1,
  warmupRepetitions: 0,
  timeBudgetMs: 1_000,
  nodeBudget: 5_000,
};

describe('createBenchmarkPort invalid suite config cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', mocks.workerCtor as unknown as typeof Worker);
    mocks.createBenchmarkClient.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      name: 'negative warmupRepetitions',
      suite: { ...validSuite, warmupRepetitions: -1 },
      expectedMessage: 'Benchmark warmup repetitions must be zero or a positive number.',
    },
    {
      name: 'non-positive repetitions',
      suite: { ...validSuite, repetitions: 0 },
      expectedMessage: 'Benchmark repetitions must be a positive number.',
    },
    {
      name: 'invalid timeBudgetMs',
      suite: { ...validSuite, timeBudgetMs: 0 },
      expectedMessage: 'Benchmark time budget must be a positive number.',
    },
    {
      name: 'invalid nodeBudget',
      suite: { ...validSuite, nodeBudget: -5 },
      expectedMessage: 'Benchmark node budget must be a positive number.',
    },
  ])('rejects $name, disposes the client, and unlocks the port', async (testCase) => {
    const invalidClient = createClientMock();
    const retryClient = createClientMock();
    const createdClients = [invalidClient, retryClient];

    mocks.createBenchmarkClient.mockImplementation(
      (options?: { createWorker?: () => unknown }): BenchmarkClient => {
        options?.createWorker?.();
        const client = createdClients.shift();
        if (!client) {
          throw new Error('Unexpected benchmark client creation.');
        }
        return client;
      },
    );

    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-invalid-config',
        suite: testCase.suite,
        levelResolver: () => createLevelRuntime(),
      }),
    ).rejects.toThrow(testCase.expectedMessage);

    expect(invalidClient.runSuite).not.toHaveBeenCalled();
    expect(invalidClient.dispose).toHaveBeenCalledTimes(1);

    await expect(
      port.runSuite({
        suiteRunId: 'bench-valid-retry',
        suite: validSuite,
        levelResolver: () => createLevelRuntime(),
      }),
    ).resolves.toHaveLength(1);

    expect(retryClient.runSuite).toHaveBeenCalledTimes(1);
    expect(retryClient.dispose).toHaveBeenCalledTimes(1);
    expect(mocks.createBenchmarkClient).toHaveBeenCalledTimes(2);

    port.dispose();
  });
});
