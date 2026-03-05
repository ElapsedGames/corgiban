import { afterEach, describe, expect, it, vi } from 'vitest';

type SolverClientFactoryOptions = {
  createWorker?: () => unknown;
};

describe('createSolverPort worker URL guards', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('@corgiban/worker');
    vi.doUnmock('../solverWorker.client.ts?worker&url');
    vi.resetModules();
  });

  it('throws when the worker URL resolves to an empty string', async () => {
    const createSolverClient = vi.fn((options?: SolverClientFactoryOptions) => {
      options?.createWorker?.();
      return {
        solve: vi.fn(),
        cancel: vi.fn(),
        ping: vi.fn(),
        retry: vi.fn(),
        getWorkerHealth: vi.fn(() => 'idle' as const),
        subscribeWorkerHealth: vi.fn(() => () => undefined),
        dispose: vi.fn(),
      };
    });

    vi.doMock('@corgiban/worker', () => ({
      createSolverClient,
    }));
    vi.doMock('../solverWorker.client.ts?worker&url', () => ({
      default: '',
    }));
    vi.stubGlobal(
      'Worker',
      class WorkerMock {
        constructor(_url: string, _options?: { type?: 'module'; name?: string }) {}
      },
    );

    const { createSolverPort } = await import('../solverPort.client');

    expect(() => createSolverPort()).toThrow('Solver worker URL resolved to an empty string.');
  });
});
