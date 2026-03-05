import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createSolverClient: vi.fn(),
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

vi.mock('@corgiban/worker', () => ({
  createSolverClient: mocks.createSolverClient,
}));

vi.mock('../solverWorker.client.ts?worker&url', () => ({
  default: '/app/ports/solverWorker.client.ts?worker_file&type=module',
}));

import { createSolverPort } from '../solverPort.client';

type WorkerLike = {
  source?: string;
  options?: { type?: 'module'; name?: string };
  onmessage: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessageerror: ((event: unknown) => void) | null;
  postMessage: () => void;
  terminate: () => void;
};

function createClientMock(): any {
  return {
    solve: vi.fn(async (..._args: unknown[]) => ({
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
    })),
    cancel: vi.fn(),
    ping: vi.fn(async () => undefined),
    retry: vi.fn(),
    getWorkerHealth: vi.fn(() => 'idle'),
    subscribeWorkerHealth: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  };
}

const sampleSolveRequest = {
  runId: 'run-1',
  levelRuntime: {
    levelId: 'level-1',
    width: 1,
    height: 1,
    staticGrid: new Uint8Array([0]),
    initialPlayerIndex: 0,
    initialBoxes: new Uint32Array([]),
  },
  algorithmId: 'bfsPush',
} as const;

describe('createSolverPort (client)', () => {
  beforeEach(() => {
    vi.stubGlobal('Worker', mocks.workerCtor as unknown as typeof Worker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('injects an app-owned module worker factory into createSolverClient', () => {
    const clientMock = createClientMock();
    mocks.createSolverClient.mockReturnValue(clientMock);

    createSolverPort();

    expect(mocks.createSolverClient).toHaveBeenCalledTimes(1);
    const options = mocks.createSolverClient.mock.calls[0][0] as
      | { createWorker?: () => WorkerLike }
      | undefined;

    expect(options?.createWorker).toBeTypeOf('function');

    const worker = options?.createWorker?.();
    expect(worker).toBeDefined();
    expect(mocks.workerCtor).toHaveBeenCalledTimes(1);
    expect(mocks.workerCtor).toHaveBeenCalledWith(
      '/app/ports/solverWorker.client.ts?worker_file&type=module',
      { type: 'module', name: 'corgiban-solver' },
    );
    expect(worker?.source).toBe('/app/ports/solverWorker.client.ts?worker_file&type=module');
    expect(worker?.options).toEqual({ type: 'module', name: 'corgiban-solver' });
  });

  it('starts solve without a preflight ping', async () => {
    const clientMock = createClientMock();
    mocks.createSolverClient.mockReturnValue(clientMock);
    const port = createSolverPort();

    await port.startSolve(sampleSolveRequest);

    expect(clientMock.ping).not.toHaveBeenCalled();
    expect(clientMock.retry).not.toHaveBeenCalled();
    expect(clientMock.solve).toHaveBeenCalledTimes(1);
  });

  it('delegates pingWorker to solver client ping', async () => {
    const clientMock = createClientMock();
    mocks.createSolverClient.mockReturnValue(clientMock);
    const port = createSolverPort();

    await port.pingWorker();

    expect(clientMock.ping).toHaveBeenCalledTimes(1);
  });

  it('maps solver progress payloads to run-scoped app progress events', async () => {
    const clientMock = createClientMock();
    clientMock.solve = vi.fn(async (_request, callbacks) => {
      callbacks?.onProgress?.({
        type: 'SOLVE_PROGRESS',
        runId: 'solver-run-id',
        protocolVersion: 2,
        expanded: 2,
        generated: 3,
        depth: 1,
        frontier: 4,
        elapsedMs: 5,
        bestHeuristic: 6,
        bestPathSoFar: 'R',
      });
      return {
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
    });
    mocks.createSolverClient.mockReturnValue(clientMock);
    const port = createSolverPort();
    const onProgress = vi.fn();

    const result = await port.startSolve({
      ...sampleSolveRequest,
      onProgress,
      options: {
        timeBudgetMs: 1000,
        nodeBudget: 5000,
      },
    });

    expect(clientMock.solve).toHaveBeenCalledWith(
      {
        runId: 'run-1',
        levelRuntime: sampleSolveRequest.levelRuntime,
        algorithmId: 'bfsPush',
        options: {
          timeBudgetMs: 1000,
          nodeBudget: 5000,
        },
      },
      expect.any(Object),
    );
    expect(onProgress).toHaveBeenCalledWith({
      runId: 'run-1',
      expanded: 2,
      generated: 3,
      depth: 1,
      frontier: 4,
      elapsedMs: 5,
      bestHeuristic: 6,
      bestPathSoFar: 'R',
    });
    expect(result).toMatchObject({
      runId: 'run-1',
      algorithmId: 'bfsPush',
      status: 'solved',
      solutionMoves: 'R',
    });
  });

  it('omits optional progress and solution fields when solver does not provide them', async () => {
    const clientMock = createClientMock();
    clientMock.solve = vi.fn(async (_request, callbacks) => {
      callbacks?.onProgress?.({
        type: 'SOLVE_PROGRESS',
        runId: 'solver-run-id',
        protocolVersion: 2,
        expanded: 8,
        generated: 13,
        depth: 3,
        frontier: 5,
        elapsedMs: 21,
      });
      return {
        status: 'timeout',
        metrics: {
          elapsedMs: 21,
          expanded: 8,
          generated: 13,
          maxDepth: 3,
          maxFrontier: 5,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });
    mocks.createSolverClient.mockReturnValue(clientMock);
    const port = createSolverPort();
    const onProgress = vi.fn();

    const result = await port.startSolve({
      ...sampleSolveRequest,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith({
      runId: 'run-1',
      expanded: 8,
      generated: 13,
      depth: 3,
      frontier: 5,
      elapsedMs: 21,
    });
    const progressPayload = onProgress.mock.calls[0]?.[0] as Record<string, unknown>;
    expect('bestHeuristic' in progressPayload).toBe(false);
    expect('bestPathSoFar' in progressPayload).toBe(false);

    expect(result).toMatchObject({
      runId: 'run-1',
      algorithmId: 'bfsPush',
      status: 'timeout',
    });
    expect('solutionMoves' in result).toBe(false);
  });

  it('maps solver error results and optional fields correctly', async () => {
    const clientMock = createClientMock();
    clientMock.solve = vi.fn(async () => ({
      status: 'error' as const,
      errorMessage: 'Solver failed',
      metrics: {
        elapsedMs: 1,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    }));
    mocks.createSolverClient.mockReturnValue(clientMock);

    const port = createSolverPort();
    const result = await port.startSolve(sampleSolveRequest);

    expect(result).toMatchObject({
      runId: 'run-1',
      algorithmId: 'bfsPush',
      status: 'error',
      errorMessage: 'Solver failed',
    });
    expect('errorDetails' in result).toBe(false);
    expect('solutionMoves' in result).toBe(false);
  });

  it('includes errorDetails when solver error payload provides them', async () => {
    const clientMock = createClientMock();
    clientMock.solve = vi.fn(async () => ({
      status: 'error' as const,
      errorMessage: 'Solver failed',
      errorDetails: 'Detailed stack trace',
      metrics: {
        elapsedMs: 1,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    }));
    mocks.createSolverClient.mockReturnValue(clientMock);

    const port = createSolverPort();
    const result = await port.startSolve(sampleSolveRequest);

    expect(result).toMatchObject({
      runId: 'run-1',
      algorithmId: 'bfsPush',
      status: 'error',
      errorMessage: 'Solver failed',
      errorDetails: 'Detailed stack trace',
    });
  });

  it('delegates cancel, retry, health subscription, and dispose methods', () => {
    const unsubscribe = vi.fn();
    const clientMock = createClientMock();
    clientMock.subscribeWorkerHealth = vi.fn(() => unsubscribe);
    clientMock.getWorkerHealth = vi.fn(() => 'healthy');
    mocks.createSolverClient.mockReturnValue(clientMock);
    const port = createSolverPort();
    const listener = vi.fn();

    port.cancelSolve('run-cancel');
    port.retryWorker();
    const currentHealth = port.getWorkerHealth();
    const stop = port.subscribeWorkerHealth(listener);
    port.dispose();

    expect(clientMock.cancel).toHaveBeenCalledWith('run-cancel');
    expect(clientMock.retry).toHaveBeenCalledTimes(1);
    expect(clientMock.getWorkerHealth).toHaveBeenCalledTimes(1);
    expect(currentHealth).toBe('healthy');
    expect(clientMock.subscribeWorkerHealth).toHaveBeenCalledWith(listener);
    expect(stop).toBe(unsubscribe);
    expect(clientMock.dispose).toHaveBeenCalledTimes(1);
  });
});
