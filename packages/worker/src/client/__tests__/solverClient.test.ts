import { describe, expect, it, vi } from 'vitest';

import { createSolverClient } from '../solverClient.client';
import * as protocolValidation from '../../protocol/validation';

class MockWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: { message?: string; error?: unknown }) => void) | null = null;
  onmessageerror: ((event: unknown) => void) | null = null;
  readonly postedMessages: unknown[] = [];
  terminated = false;
  throwOnPostMessage = false;

  postMessage(message: unknown): void {
    if (this.throwOnPostMessage) {
      throw new Error('post failure');
    }
    this.postedMessages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  emitMessage(message: unknown): void {
    this.onmessage?.({ data: message });
  }

  emitError(message: string): void {
    this.onerror?.({ message, error: new Error(message) });
  }

  emitMessageError(): void {
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

const sampleLevelRuntime = {
  levelId: 'test-level',
  width: 3,
  height: 3,
  staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
  initialPlayerIndex: 4,
  initialBoxes: Uint32Array.from([5]),
};

describe('createSolverClient', () => {
  it('does not create a worker until first solve or ping', () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    expect(client.getWorkerHealth()).toBe('idle');
    expect(harness.workers).toHaveLength(0);

    const unsubscribe = client.subscribeWorkerHealth(() => undefined);
    expect(harness.workers).toHaveLength(0);

    unsubscribe();
  });

  it('supports default worker factory by using global Worker/URL constructors', async () => {
    const worker = new MockWorker();
    let capturedUrl: unknown;
    let capturedOptions: { type?: 'module' } | undefined;

    class WorkerCtor {
      constructor(url: unknown, options?: { type?: 'module' }) {
        capturedUrl = url;
        capturedOptions = options;
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

      const client = createSolverClient();
      const pingPromise = client.ping();

      expect(worker.postedMessages[0]).toEqual({
        type: 'PING',
        protocolVersion: 2,
      });

      worker.emitMessage({
        type: 'PONG',
        protocolVersion: 2,
      });

      await expect(pingPromise).resolves.toBeUndefined();
      expect(capturedUrl).toMatchObject({
        path: '../runtime/solverWorker.ts',
      });
      expect(capturedOptions).toEqual({ type: 'module' });

      client.dispose();
    } finally {
      (globalThis as unknown as { Worker?: unknown }).Worker = previousWorker;
      (globalThis as unknown as { URL?: unknown }).URL = previousUrl;
    }
  });

  it('maps progress/result messages and updates worker health', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });
    const progressMessages: unknown[] = [];

    expect(client.getWorkerHealth()).toBe('idle');

    const solvePromise = client.solve(
      {
        runId: 'run-1',
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      },
      {
        onProgress: (message) => {
          progressMessages.push(message);
        },
      },
    );

    expect(harness.workers[0]?.postedMessages[0]).toEqual({
      type: 'SOLVE_START',
      runId: 'run-1',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_PROGRESS',
      runId: 'run-1',
      protocolVersion: 2,
      expanded: 10,
      generated: 12,
      depth: 3,
      frontier: 4,
      elapsedMs: 5,
    });

    expect(progressMessages).toHaveLength(1);
    expect(client.getWorkerHealth()).toBe('healthy');

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-1',
      protocolVersion: 2,
      status: 'solved',
      solutionMoves: 'RR',
      metrics: {
        elapsedMs: 9,
        expanded: 10,
        generated: 12,
        maxDepth: 3,
        maxFrontier: 4,
        pushCount: 1,
        moveCount: 2,
      },
    });

    await expect(solvePromise).resolves.toMatchObject({
      type: 'SOLVE_RESULT',
      runId: 'run-1',
      status: 'solved',
    });
  });

  it('includes solve options in SOLVE_START payloads', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const solvePromise = client.solve({
      runId: 'run-with-options',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: {
        timeBudgetMs: 1_500,
        nodeBudget: 3_000,
        enableSpectatorStream: true,
      },
    });

    expect(harness.workers[0]?.postedMessages[0]).toEqual({
      type: 'SOLVE_START',
      runId: 'run-with-options',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: {
        timeBudgetMs: 1_500,
        nodeBudget: 3_000,
        enableSpectatorStream: true,
      },
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-with-options',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 2,
        expanded: 1,
        generated: 1,
        maxDepth: 1,
        maxFrontier: 1,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(solvePromise).resolves.toMatchObject({
      runId: 'run-with-options',
      status: 'unsolved',
    });
  });

  it('marks worker as crashed and rejects pending runs on onerror', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const solvePromise = client.solve({
      runId: 'run-2',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitError('solver boom');

    await expect(solvePromise).rejects.toThrow('solver boom');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('marks worker as crashed on onmessageerror', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const pingPromise = client.ping();

    harness.workers[0]?.emitMessageError();

    await expect(pingPromise).rejects.toThrow('message');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('converts worker error reasons into errors for string and unknown values', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const pingPromise = client.ping();

    const firstWorker = harness.workers[0];
    if (!firstWorker) {
      throw new Error('Expected worker instance.');
    }

    firstWorker.onerror?.({ error: 'string boom' });

    await expect(pingPromise).rejects.toThrow('string boom');
    expect(client.getWorkerHealth()).toBe('crashed');

    client.retry();

    const solvePromise = client.solve({
      runId: 'run-fallback',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    const secondWorker = harness.workers[1];
    if (!secondWorker) {
      throw new Error('Expected worker instance.');
    }

    secondWorker.onerror?.({ error: { reason: 'unknown' } });

    await expect(solvePromise).rejects.toThrow('Solver worker crashed.');
  });

  it('rejects solve immediately when the worker is already crashed', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const warmupRun = client.solve({
      runId: 'run-before-crash',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });
    harness.workers[0]?.emitError('boom');
    await expect(warmupRun).rejects.toThrow('boom');

    await expect(
      client.solve({
        runId: 'run-crashed',
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      }),
    ).rejects.toThrow('crashed');

    expect(harness.workers[0]?.postedMessages).toHaveLength(1);
  });

  it('returns a rejected promise when solve request validation fails', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    let solvePromise: Promise<unknown> | undefined;
    expect(() => {
      solvePromise = client.solve({
        runId: '',
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      });
    }).not.toThrow();

    if (!solvePromise) {
      throw new Error('Expected solve promise.');
    }

    await expect(solvePromise).rejects.toThrow('Invalid inbound protocol message');
    expect(harness.workers).toHaveLength(0);
    expect(client.getWorkerHealth()).toBe('idle');
  });

  it('marks worker as crashed on invalid outbound messages', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const solvePromise = client.solve({
      runId: 'run-invalid',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_PROGRESS',
      runId: 'run-invalid',
      protocolVersion: 2,
    });

    await expect(solvePromise).rejects.toThrow('Invalid outbound protocol message');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('accepts SOLVE_PROGRESS unknown fields when light-progress mode is enabled', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({
      createWorker: harness.createWorker,
      outboundValidationMode: 'light-progress',
    });
    const progressMessages: unknown[] = [];

    const solvePromise = client.solve(
      {
        runId: 'run-light-progress',
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      },
      {
        onProgress: (message) => {
          progressMessages.push(message);
        },
      },
    );

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_PROGRESS',
      runId: 'run-light-progress',
      protocolVersion: 2,
      expanded: 3,
      generated: 5,
      depth: 1,
      frontier: 2,
      elapsedMs: 7,
      extraDebugField: 'allowed-in-light-mode',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-light-progress',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 8,
        expanded: 3,
        generated: 5,
        maxDepth: 1,
        maxFrontier: 2,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(solvePromise).resolves.toMatchObject({ runId: 'run-light-progress' });
    expect(progressMessages).toHaveLength(1);
    expect(client.getWorkerHealth()).toBe('healthy');
  });

  it('ignores error and result messages for unknown runIds', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const solvePromise = client.solve({
      runId: 'run-known',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_ERROR',
      runId: 'run-ghost',
      protocolVersion: 2,
      message: 'ignored',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-ghost',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-known',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(solvePromise).resolves.toMatchObject({ runId: 'run-known' });
    expect(client.getWorkerHealth()).toBe('healthy');
  });

  it('rejects ping when postMessage throws', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const firstPing = client.ping();
    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });
    await expect(firstPing).resolves.toBeUndefined();

    const worker = harness.workers[0];

    if (!worker) {
      throw new Error('Expected worker instance.');
    }
    worker.throwOnPostMessage = true;

    await expect(client.ping()).rejects.toThrow('post failure');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('rejects duplicate ping requests', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const firstPing = client.ping();
    const secondPing = client.ping();

    await expect(secondPing).rejects.toThrow('ping already in flight');

    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });

    await expect(firstPing).resolves.toBeUndefined();
  });

  it('ignores PONG when no ping is pending', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    expect(client.getWorkerHealth()).toBe('idle');

    const firstPing = client.ping();
    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });

    await expect(firstPing).resolves.toBeUndefined();

    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });

    expect(client.getWorkerHealth()).toBe('healthy');
  });

  it('rejects ping immediately after a crash', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const warmupPing = client.ping();
    harness.workers[0]?.emitError('boom');
    await expect(warmupPing).rejects.toThrow('boom');

    await expect(client.ping()).rejects.toThrow('crashed');
    expect(harness.workers[0]?.postedMessages).toHaveLength(1);
  });

  it('retry recreates worker, clears stuck runs, and resets health to idle', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const solvePromise = client.solve({
      runId: 'run-3',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    client.retry();

    await expect(solvePromise).rejects.toThrow('reset');
    expect(harness.workers[0]?.terminated).toBe(true);
    expect(harness.workers).toHaveLength(2);
    expect(client.getWorkerHealth()).toBe('idle');

    const secondSolve = client.solve({
      runId: 'run-4',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.workers[1]?.postedMessages[0]).toEqual({
      type: 'SOLVE_START',
      runId: 'run-4',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[1]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-4',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 5,
        expanded: 5,
        generated: 5,
        maxDepth: 1,
        maxFrontier: 1,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(secondSolve).resolves.toMatchObject({
      runId: 'run-4',
      status: 'unsolved',
    });
  });

  it('notifies worker health subscribers and supports unsubscribe', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });
    const updates: string[] = [];

    const unsubscribe = client.subscribeWorkerHealth((health) => updates.push(health));

    const firstPing = client.ping();
    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });
    await expect(firstPing).resolves.toBeUndefined();

    unsubscribe();

    harness.workers[0]?.emitError('boom');

    expect(updates).toEqual(['healthy']);
  });

  it('enforces one active run per solver client instance', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const firstRun = client.solve({
      runId: 'run-1',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    const secondRun = client.solve({
      runId: 'run-2',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    await expect(secondRun).rejects.toThrow('one active run per instance');

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-1',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(firstRun).resolves.toMatchObject({ status: 'unsolved' });
  });

  it('cancel terminates and recreates the worker and rejects the pending run', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const run = client.solve({
      runId: 'run-cancel',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    client.cancel('run-cancel');

    await expect(run).rejects.toThrow('Solver run cancelled by user.');
    expect(harness.workers[0]?.terminated).toBe(true);
    expect(harness.workers).toHaveLength(2);
    expect(client.getWorkerHealth()).toBe('idle');

    const nextRun = client.solve({
      runId: 'run-after-cancel',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[1]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-after-cancel',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(nextRun).resolves.toMatchObject({ status: 'unsolved' });
  });

  it('recreates the worker when cancelling a non-active run id', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const ping = client.ping();
    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });
    await expect(ping).resolves.toBeUndefined();

    client.cancel('run-missing');

    expect(harness.workers[0]?.terminated).toBe(true);
    expect(harness.workers).toHaveLength(2);
    expect(client.getWorkerHealth()).toBe('idle');
  });

  it('ignores stale worker events after cancellation-based worker recreation', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const firstRun = client.solve({
      runId: 'run-stale-1',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    const staleWorker = harness.workers[0];
    if (!staleWorker) {
      throw new Error('Expected worker instance.');
    }

    client.cancel('run-stale-1');
    await expect(firstRun).rejects.toThrow('Solver run cancelled by user.');

    staleWorker.emitError('stale worker boom');
    staleWorker.emitMessageError();
    expect(client.getWorkerHealth()).toBe('idle');

    const secondRun = client.solve({
      runId: 'run-stale-2',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[1]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-stale-2',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(secondRun).resolves.toMatchObject({ runId: 'run-stale-2' });
  });

  it('ignores stale worker onmessage events after worker recreation', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const firstRun = client.solve({
      runId: 'run-stale-message-1',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    const staleWorker = harness.workers[0];
    if (!staleWorker) {
      throw new Error('Expected worker instance.');
    }

    client.cancel('run-stale-message-1');
    await expect(firstRun).rejects.toThrow('Solver run cancelled by user.');

    staleWorker.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-stale-message-1',
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
    expect(client.getWorkerHealth()).toBe('idle');

    const secondRun = client.solve({
      runId: 'run-stale-message-2',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[1]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-stale-message-2',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(secondRun).resolves.toMatchObject({ runId: 'run-stale-message-2' });
  });

  it('ignores unexpected but schema-valid outbound message types', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const run = client.solve({
      runId: 'run-unexpected-outbound',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitMessage({
      type: 'BENCH_RESULT',
      runId: 'run-unexpected-outbound',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-unexpected-outbound',
      protocolVersion: 2,
      status: 'unsolved',
      metrics: {
        elapsedMs: 2,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    await expect(run).resolves.toMatchObject({ runId: 'run-unexpected-outbound' });
    expect(client.getWorkerHealth()).toBe('healthy');
  });

  it('rejects runs when SOLVE_ERROR is received and disposes cleanly', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const run = client.solve({
      runId: 'run-error',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_ERROR',
      runId: 'run-error',
      protocolVersion: 2,
      message: 'Bad news',
      details: 'extra info',
    });

    await expect(run).rejects.toThrow('Bad news extra info');

    client.dispose();
    expect(harness.workers[0]?.terminated).toBe(true);
    expect(client.getWorkerHealth()).toBe('idle');
  });

  it('rejects in-flight ping when dispose is called', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const pingPromise = client.ping();
    const worker = harness.workers[0];
    if (!worker) {
      throw new Error('Expected worker instance.');
    }

    client.dispose();

    await expect(pingPromise).rejects.toThrow('Solver client disposed.');
    expect(worker.terminated).toBe(true);
    expect(client.getWorkerHealth()).toBe('idle');
  });

  it('rejects in-flight solve when dispose is called', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const runPromise = client.solve({
      runId: 'run-dispose-active',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    client.dispose();

    await expect(runPromise).rejects.toThrow('Solver client disposed.');
    expect(harness.workers[0]?.terminated).toBe(true);
    expect(client.getWorkerHealth()).toBe('idle');
  });

  it('treats dispose as idempotent before any worker is created', () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    client.dispose();
    client.dispose();

    expect(harness.workers).toHaveLength(0);
    expect(client.getWorkerHealth()).toBe('idle');
  });

  it('rejects runs when SOLVE_ERROR has no details', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const run = client.solve({
      runId: 'run-error-plain',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.emitMessage({
      type: 'SOLVE_ERROR',
      runId: 'run-error-plain',
      protocolVersion: 2,
      message: 'Bad news',
    });

    await expect(run).rejects.toThrow(/^Bad news$/);
  });

  it('marks the worker as crashed when postMessage fails', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const firstPing = client.ping();
    harness.workers[0]?.emitMessage({
      type: 'PONG',
      protocolVersion: 2,
    });
    await expect(firstPing).resolves.toBeUndefined();

    const worker = harness.workers[0];

    if (!worker) {
      throw new Error('Expected worker instance.');
    }
    worker.throwOnPostMessage = true;

    const run = client.solve({
      runId: 'run-fail',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    await expect(run).rejects.toThrow('post failure');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('uses worker event.message when event.error is unavailable', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const run = client.solve({
      runId: 'run-message-fallback',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    harness.workers[0]?.onerror?.({ message: 'message only failure' });

    await expect(run).rejects.toThrow('message only failure');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('uses unknown worker error fallback when no error detail is present', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });

    const ping = client.ping();
    harness.workers[0]?.onerror?.({});

    await expect(ping).rejects.toThrow('Unknown worker error.');
    expect(client.getWorkerHealth()).toBe('crashed');
  });

  it('rejects ping before worker creation when ping message validation fails', async () => {
    const harness = createWorkerHarness();
    const client = createSolverClient({ createWorker: harness.createWorker });
    const validationSpy = vi
      .spyOn(protocolValidation, 'assertInboundMessage')
      .mockImplementationOnce(() => {
        throw new Error('invalid ping payload');
      });

    await expect(client.ping()).rejects.toThrow('invalid ping payload');
    expect(harness.workers).toHaveLength(0);

    validationSpy.mockRestore();
  });
});
