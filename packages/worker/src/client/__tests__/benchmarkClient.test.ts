import { describe, expect, it } from 'vitest';

import type { BenchProgressMessage, BenchResultMessage } from '../../protocol/protocol';
import { createBenchmarkClient } from '../benchmarkClient.client';

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: unknown) => void;
  const promise = new Promise<T>((resolveFn, rejectFn) => {
    resolve = resolveFn;
    reject = rejectFn;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

async function waitForRunCount(worker: MockBenchmarkWorkerClient, expectedCount: number) {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if (worker.runs.length >= expectedCount) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(`Expected ${expectedCount} runs, found ${worker.runs.length}.`);
}

type CapturedRun = {
  request: {
    runId: string;
    benchmarkCaseId?: string;
  };
  callbacks?: {
    onDispatch?: () => void;
    onProgress?: (message: BenchProgressMessage) => void;
  };
  deferred: ReturnType<typeof createDeferred<BenchResultMessage>>;
};

class MockBenchmarkWorkerClient {
  readonly runs: CapturedRun[] = [];
  disposed = false;

  run(request: CapturedRun['request'], callbacks?: CapturedRun['callbacks']) {
    const deferred = createDeferred<BenchResultMessage>();
    this.runs.push({ request, callbacks, deferred });
    callbacks?.onDispatch?.();
    return deferred.promise;
  }

  dispose() {
    this.disposed = true;
  }
}

class MockWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message?: string; error?: unknown }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  readonly postedMessages: unknown[] = [];
  sourceUrl?: unknown;
  workerOptions?: { type?: 'module' };
  terminated = false;
  throwOnPostMessage = false;

  postMessage(message: unknown) {
    if (this.throwOnPostMessage) {
      throw new Error('post failure');
    }
    this.postedMessages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emitMessage(message: unknown) {
    this.onmessage?.({ data: message });
  }

  emitError(message: string) {
    this.onerror?.({ message, error: new Error(message) });
  }

  emitMessageError() {
    this.onmessageerror?.({});
  }
}

function createWorkerHarness() {
  const workers: MockWorker[] = [];
  return {
    workers,
    createWorker: () => {
      const worker = new MockWorker();
      workers.push(worker);
      return worker;
    },
  };
}

async function waitForWorkerMessage(worker: MockWorker, expectedCount: number) {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    if (worker.postedMessages.length >= expectedCount) {
      return;
    }
    await Promise.resolve();
  }
  throw new Error(
    `Expected ${expectedCount} posted messages, found ${worker.postedMessages.length}.`,
  );
}

async function waitForWorkerCreated(harness: { workers: MockWorker[] }): Promise<MockWorker> {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const worker = harness.workers.at(-1);
    if (worker) {
      return worker;
    }
    await Promise.resolve();
  }
  throw new Error('Expected worker.');
}

function createWorkerClientFactory() {
  const workers: MockBenchmarkWorkerClient[] = [];
  return {
    workers,
    createWorkerClient: () => {
      const worker = new MockBenchmarkWorkerClient();
      workers.push(worker);
      return worker;
    },
  };
}

const sampleLevelRuntime = {
  levelId: 'test-level',
  width: 3,
  height: 3,
  staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
  initialPlayerIndex: 4,
  initialBoxes: Uint32Array.from([5]),
};

function buildResult(runId: string): BenchResultMessage {
  return {
    type: 'BENCH_RESULT',
    runId,
    protocolVersion: 2,
    status: 'solved',
    solutionMoves: 'R',
    metrics: {
      elapsedMs: 1,
      expanded: 1,
      generated: 1,
      maxDepth: 1,
      maxFrontier: 1,
      pushCount: 1,
      moveCount: 1,
    },
  };
}

describe('createBenchmarkClient', () => {
  it('uses the benchmark pool-size formula from hardwareConcurrency', () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      hardwareConcurrency: 8,
    });

    expect(client.getPoolSize()).toBe(4);
    expect(harness.workers).toHaveLength(4);
  });

  it('runs a suite through the pool and forwards progress/result callbacks', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const progressEvents: string[] = [];
    const resultEvents: string[] = [];

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-1',
          benchmarkCaseId: 'case-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
        {
          runId: 'run-2',
          benchmarkCaseId: 'case-2',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
      callbacks: {
        onProgress: (message, request) => {
          progressEvents.push(`${request.runId}:${message.elapsedMs}`);
        },
        onResult: (message, request) => {
          resultEvents.push(`${request.runId}:${message.status}`);
        },
      },
    });

    const worker = harness.workers.at(-1);
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    expect(worker.runs).toHaveLength(1);
    expect(worker.runs[0]?.request.runId).toBe('run-1');

    worker.runs[0]?.callbacks?.onProgress?.({
      type: 'BENCH_PROGRESS',
      runId: 'run-1',
      protocolVersion: 2,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 5,
    });
    worker.runs[0]?.deferred.resolve(buildResult('run-1'));

    await waitForRunCount(worker, 2);
    expect(worker.runs).toHaveLength(2);
    expect(worker.runs[1]?.request.runId).toBe('run-2');

    worker.runs[1]?.callbacks?.onProgress?.({
      type: 'BENCH_PROGRESS',
      runId: 'run-2',
      protocolVersion: 2,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 9,
    });
    worker.runs[1]?.deferred.resolve(buildResult('run-2'));

    await expect(suitePromise).resolves.toEqual([buildResult('run-1'), buildResult('run-2')]);
    expect(progressEvents).toEqual(['run-1:5', 'run-2:9']);
    expect(resultEvents).toEqual(['run-1:solved', 'run-2:solved']);
  });

  it('forwards complete run requests to onDispatch callbacks', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const dispatches: Array<{ runId: string; benchmarkCaseId?: string; hasOptions: boolean }> = [];

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-dispatch-request',
          benchmarkCaseId: 'case-dispatch',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
          options: {
            timeBudgetMs: 1_000,
            nodeBudget: 2_000,
            enableSpectatorStream: true,
          },
        },
      ],
      callbacks: {
        onDispatch: (request) => {
          dispatches.push({
            runId: request.runId,
            benchmarkCaseId: request.benchmarkCaseId,
            hasOptions: request.options !== undefined,
          });
        },
      },
    });

    const worker = harness.workers.at(-1);
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    worker.runs[0]?.deferred.resolve(buildResult('run-dispatch-request'));

    await expect(suitePromise).resolves.toEqual([buildResult('run-dispatch-request')]);
    expect(dispatches).toEqual([
      {
        runId: 'run-dispatch-request',
        benchmarkCaseId: 'case-dispatch',
        hasOptions: true,
      },
    ]);
  });

  it('supports queue-only cancellation via cancel(runId)', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
        {
          runId: 'run-2',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = harness.workers[0];
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    expect(worker.runs).toHaveLength(1);
    expect(client.cancel('run-2')).toBe(true);
    expect(client.cancel('run-1')).toBe(false);

    worker.runs[0]?.deferred.resolve(buildResult('run-1'));
    await expect(suitePromise).rejects.toThrow('WorkerPool cancelled run run-2.');
    expect(worker.runs).toHaveLength(1);
  });

  it('uses cancelSuite for in-flight cancellation and suppresses stale callbacks', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const progressEvents: string[] = [];
    const resultEvents: string[] = [];

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
      callbacks: {
        onProgress: (message) => progressEvents.push(String(message.elapsedMs)),
        onResult: (message) => resultEvents.push(message.runId),
      },
    });

    const worker = harness.workers[0];
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    expect(worker.runs).toHaveLength(1);
    client.cancelSuite();

    await expect(suitePromise).rejects.toThrow('Benchmark suite cancelled.');

    worker.runs[0]?.callbacks?.onProgress?.({
      type: 'BENCH_PROGRESS',
      runId: 'run-1',
      protocolVersion: 2,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 33,
    });
    worker.runs[0]?.deferred.resolve(buildResult('run-1'));
    await Promise.resolve();

    expect(progressEvents).toEqual([]);
    expect(resultEvents).toEqual([]);
  });

  it('suppresses queued dispatch callbacks after cancelSuite invalidates the suite', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const dispatches: string[] = [];

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-cancel-dispatch-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
        {
          runId: 'run-cancel-dispatch-2',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
      callbacks: {
        onDispatch: (request) => dispatches.push(request.runId),
      },
    });

    const worker = harness.workers[0];
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    expect(dispatches).toEqual(['run-cancel-dispatch-1']);

    client.cancelSuite();

    await expect(suitePromise).rejects.toThrow('Benchmark suite cancelled.');
    expect(dispatches).toEqual(['run-cancel-dispatch-1']);
  });

  it('suppresses late results after dispose and disposes pooled workers', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const resultEvents: string[] = [];

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
      callbacks: {
        onResult: (message) => resultEvents.push(message.runId),
      },
    });

    const worker = harness.workers[0];
    if (!worker) {
      throw new Error('Expected worker.');
    }

    client.dispose();

    await expect(suitePromise).rejects.toThrow('Benchmark client disposed.');
    worker.runs[0]?.deferred.resolve(buildResult('run-1'));
    await Promise.resolve();

    expect(resultEvents).toEqual([]);
    expect(worker.disposed).toBe(true);
  });

  it('rejects overlapping suites on the same benchmark client instance', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const firstSuite = client.runSuite({
      runs: [
        {
          runId: 'run-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    await expect(
      client.runSuite({
        runs: [
          {
            runId: 'run-2',
            levelRuntime: sampleLevelRuntime,
            algorithmId: 'bfsPush',
          },
        ],
      }),
    ).rejects.toThrow('already running');

    harness.workers[0]?.runs[0]?.deferred.resolve(buildResult('run-1'));
    await expect(firstSuite).resolves.toEqual([buildResult('run-1')]);
  });

  it('clears active suite state after run failure and allows a subsequent suite', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    const firstSuite = client.runSuite({
      runs: [
        {
          runId: 'run-fail',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = harness.workers[0];
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    worker.runs[0]?.deferred.reject(new Error('worker run failed'));
    await expect(firstSuite).rejects.toThrow('worker run failed');

    const secondSuite = client.runSuite({
      runs: [
        {
          runId: 'run-after-fail',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    await waitForRunCount(worker, 2);
    worker.runs[1]?.deferred.resolve(buildResult('run-after-fail'));
    await expect(secondSuite).resolves.toEqual([buildResult('run-after-fail')]);
  });

  it('rejects runSuite and queue cancellation calls after dispose', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    client.dispose();
    client.cancelSuite();

    expect(client.cancel('run-1')).toBe(false);
    await expect(client.runSuite({ runs: [] })).rejects.toThrow('Benchmark client disposed.');
  });

  it('treats cancelSuite as a no-op when no suite is active', async () => {
    const harness = createWorkerClientFactory();
    const client = createBenchmarkClient({
      createWorkerClient: harness.createWorkerClient,
      poolSize: 1,
    });

    client.cancelSuite();

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-after-idle-cancel',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = harness.workers.at(-1);
    if (!worker) {
      throw new Error('Expected worker.');
    }

    await waitForRunCount(worker, 1);
    worker.runs[0]?.deferred.resolve(buildResult('run-after-idle-cancel'));
    await expect(suitePromise).resolves.toEqual([buildResult('run-after-idle-cancel')]);
  });

  it('resolves pool size from global navigator when options are omitted', () => {
    const host = globalThis as unknown as {
      navigator?: {
        hardwareConcurrency?: number;
      };
    };
    const previousNavigator = host.navigator;
    try {
      Object.defineProperty(host, 'navigator', {
        configurable: true,
        value: { hardwareConcurrency: 6 },
      });

      const client = createBenchmarkClient({
        createWorkerClient: createWorkerClientFactory().createWorkerClient,
      });

      expect(client.getPoolSize()).toBe(4);
      client.dispose();
    } finally {
      Object.defineProperty(host, 'navigator', {
        configurable: true,
        value: previousNavigator,
      });
    }
  });
});

describe('createBenchmarkClient internal worker client path', () => {
  it('posts BENCH_START, maps BENCH_PROGRESS/BENCH_RESULT, and returns suite results', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const progressEvents: string[] = [];
    const resultEvents: string[] = [];

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-1',
          benchmarkCaseId: 'case-1',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
      callbacks: {
        onProgress: (message, request) => {
          progressEvents.push(`${request.runId}:${message.elapsedMs}`);
        },
        onResult: (message, request) => {
          resultEvents.push(`${request.runId}:${message.status}`);
        },
      },
    });

    const worker = await waitForWorkerCreated(harness);

    await waitForWorkerMessage(worker, 1);
    expect(worker.postedMessages[0]).toEqual({
      type: 'BENCH_START',
      runId: 'run-1',
      protocolVersion: 2,
      benchmarkCaseId: 'case-1',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    worker.emitMessage({
      type: 'BENCH_PROGRESS',
      runId: 'run-1',
      benchmarkCaseId: 'case-1',
      protocolVersion: 2,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 5,
    });
    worker.emitMessage({
      type: 'BENCH_RESULT',
      runId: 'run-1',
      benchmarkCaseId: 'case-1',
      protocolVersion: 2,
      status: 'solved',
      solutionMoves: 'R',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 1,
        maxFrontier: 1,
        pushCount: 1,
        moveCount: 1,
      },
    });

    await expect(suitePromise).resolves.toEqual([
      {
        ...buildResult('run-1'),
        benchmarkCaseId: 'case-1',
      },
    ]);
    expect(progressEvents).toEqual(['run-1:5']);
    expect(resultEvents).toEqual(['run-1:solved']);
    expect(worker.terminated).toBe(false);
  });

  it('includes solver options in BENCH_START payload when provided', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-with-options',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
          options: {
            timeBudgetMs: 1_234,
            nodeBudget: 5_678,
            enableSpectatorStream: true,
          },
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    expect(worker.postedMessages[0]).toEqual({
      type: 'BENCH_START',
      runId: 'run-with-options',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: {
        timeBudgetMs: 1_234,
        nodeBudget: 5_678,
        enableSpectatorStream: true,
      },
    });

    worker.emitMessage(buildResult('run-with-options'));
    await expect(suitePromise).resolves.toEqual([buildResult('run-with-options')]);
  });

  it('omits optional BENCH_START fields when request does not provide them', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-without-optionals',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    const posted = worker.postedMessages[0] as Record<string, unknown>;
    expect(posted.type).toBe('BENCH_START');
    expect(posted.runId).toBe('run-without-optionals');
    expect(posted).not.toHaveProperty('options');
    expect(posted).not.toHaveProperty('benchmarkCaseId');

    worker.emitMessage(buildResult('run-without-optionals'));
    await expect(suitePromise).resolves.toEqual([buildResult('run-without-optionals')]);
  });

  it('fires onDispatch once per run before progress and result callbacks', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const callbackOrder: string[] = [];
    const runId = 'run-dispatch-order';

    const suitePromise = client.runSuite({
      runs: [
        {
          runId,
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
      callbacks: {
        onDispatch: (request) => {
          callbackOrder.push(`${request.runId}:dispatch`);
        },
        onProgress: (message, request) => {
          callbackOrder.push(`${request.runId}:progress:${message.elapsedMs}`);
        },
        onResult: (message, request) => {
          callbackOrder.push(`${request.runId}:result:${message.status}`);
        },
      },
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    expect(callbackOrder).toEqual([`${runId}:dispatch`]);

    worker.emitMessage({
      type: 'BENCH_PROGRESS',
      runId,
      protocolVersion: 2,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 7,
    });
    worker.emitMessage(buildResult(runId));

    await expect(suitePromise).resolves.toEqual([buildResult(runId)]);
    expect(callbackOrder).toEqual([
      `${runId}:dispatch`,
      `${runId}:progress:7`,
      `${runId}:result:solved`,
    ]);
    expect(callbackOrder.filter((entry) => entry.endsWith(':dispatch'))).toHaveLength(1);
  });

  it('ignores PONG and unknown run ids from benchmark worker', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-known',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    worker.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });
    worker.emitMessage({
      type: 'BENCH_RESULT',
      runId: 'run-unknown',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 0,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });
    worker.emitMessage(buildResult('run-known'));

    await expect(suitePromise).resolves.toEqual([buildResult('run-known')]);
  });

  it('rejects suite when benchmark worker emits invalid outbound payload', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-invalid',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    worker.emitMessage({
      type: 'BENCH_PROGRESS',
      runId: 'run-invalid',
      protocolVersion: 2,
    });

    await expect(suitePromise).rejects.toThrow('Invalid outbound protocol message');
    expect(worker.terminated).toBe(true);
  });

  it('rejects suite when benchmark worker emits unexpected SOLVE_PROGRESS', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-unexpected',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    worker.emitMessage({
      type: 'SOLVE_PROGRESS',
      runId: 'run-unexpected',
      protocolVersion: 2,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 1,
    });

    await expect(suitePromise).rejects.toThrow('Unexpected outbound message type SOLVE_PROGRESS');
    expect(worker.terminated).toBe(true);
  });

  it('rejects run from SOLVE_ERROR and worker crash events', async () => {
    const harnessA = createWorkerHarness();
    const clientA = createBenchmarkClient({
      createWorker: harnessA.createWorker,
      poolSize: 1,
    });

    const suiteA = clientA.runSuite({
      runs: [
        {
          runId: 'run-error',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const workerA = await waitForWorkerCreated(harnessA);
    await waitForWorkerMessage(workerA, 1);
    workerA.emitMessage({
      type: 'SOLVE_ERROR',
      runId: 'run-error',
      protocolVersion: 2,
      message: 'benchmark failed',
      details: 'worker detail',
    });
    await expect(suiteA).rejects.toThrow('benchmark failed worker detail');

    const harnessB = createWorkerHarness();
    const clientB = createBenchmarkClient({
      createWorker: harnessB.createWorker,
      poolSize: 1,
    });
    const suiteB = clientB.runSuite({
      runs: [
        {
          runId: 'run-crash',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });
    const workerB = await waitForWorkerCreated(harnessB);
    await waitForWorkerMessage(workerB, 1);
    workerB.emitError('benchmark worker crashed');

    await expect(suiteB).rejects.toThrow('benchmark worker crashed');
    expect(workerB.terminated).toBe(true);
  });

  it('uses a fallback error when worker crash events have no details', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });
    const suite = client.runSuite({
      runs: [
        {
          runId: 'run-fallback-error',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });
    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    worker.onerror?.({});
    await expect(suite).rejects.toThrow('Unknown benchmark worker error.');
    expect(worker.terminated).toBe(true);
  });

  it('rejects suite when worker postMessage throws', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: () => {
        const worker = harness.createWorker();
        worker.throwOnPostMessage = true;
        return worker;
      },
      poolSize: 1,
    });

    await expect(
      client.runSuite({
        runs: [
          {
            runId: 'run-post-fail',
            levelRuntime: sampleLevelRuntime,
            algorithmId: 'bfsPush',
          },
        ],
      }),
    ).rejects.toThrow('post failure');
  });

  it('rejects suite when worker message channel fails', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suite = client.runSuite({
      runs: [
        {
          runId: 'run-messageerror',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);
    worker.emitMessageError();

    await expect(suite).rejects.toThrow('message channel');
    expect(worker.terminated).toBe(true);
  });

  it('rejects invalid BENCH_START requests before posting to worker', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    await expect(
      client.runSuite({
        runs: [
          {
            runId: '',
            levelRuntime: sampleLevelRuntime,
            algorithmId: 'bfsPush',
          },
        ],
      }),
    ).rejects.toThrow('Invalid inbound protocol message');
  });

  it('supports default worker factory by using global Worker/URL constructors', async () => {
    const worker = new MockWorker();
    class WorkerCtor {
      constructor(url: unknown, options?: { type?: 'module' }) {
        worker.sourceUrl = url;
        worker.workerOptions = options;
        return worker;
      }
    }

    class UrlCtor {
      readonly path: string;
      readonly base: string;

      constructor(path: string, base: string) {
        this.path = path;
        this.base = base;
      }
    }

    const previousWorker = (globalThis as unknown as { Worker?: unknown }).Worker;
    const previousUrl = (globalThis as unknown as { URL?: unknown }).URL;
    try {
      (globalThis as unknown as { Worker?: unknown }).Worker = WorkerCtor;
      (globalThis as unknown as { URL?: unknown }).URL = UrlCtor;

      const client = createBenchmarkClient({ poolSize: 1 });
      const suitePromise = client.runSuite({
        runs: [
          {
            runId: 'run-default-factory',
            levelRuntime: sampleLevelRuntime,
            algorithmId: 'bfsPush',
          },
        ],
      });

      await waitForWorkerMessage(worker, 1);
      worker.emitMessage(buildResult('run-default-factory'));
      await expect(suitePromise).resolves.toEqual([buildResult('run-default-factory')]);
      expect(worker.sourceUrl).toMatchObject({
        path: '../runtime/benchmarkWorker.ts',
      });
      expect(worker.workerOptions).toEqual({ type: 'module' });

      client.dispose();
    } finally {
      (globalThis as unknown as { Worker?: unknown }).Worker = previousWorker;
      (globalThis as unknown as { URL?: unknown }).URL = previousUrl;
    }
  });

  it('treats repeated dispose calls as a no-op after the first dispose', async () => {
    const harness = createWorkerHarness();
    const client = createBenchmarkClient({
      createWorker: harness.createWorker,
      poolSize: 1,
    });

    const suitePromise = client.runSuite({
      runs: [
        {
          runId: 'run-dispose-twice',
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        },
      ],
    });

    const worker = await waitForWorkerCreated(harness);
    await waitForWorkerMessage(worker, 1);

    client.dispose();
    client.dispose();

    await expect(suitePromise).rejects.toThrow('Benchmark client disposed.');
    expect(worker.terminated).toBe(true);
  });
});
