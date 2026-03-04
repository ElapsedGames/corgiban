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

function createClientMock() {
  return {
    solve: vi.fn(async () => ({
      status: 'solved' as const,
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
    getWorkerHealth: vi.fn(() => 'idle' as const),
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
});
