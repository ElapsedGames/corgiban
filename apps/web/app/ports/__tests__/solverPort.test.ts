import { describe, expect, it } from 'vitest';

import { createNoopSolverPort } from '../solverPort';

describe('createNoopSolverPort', () => {
  it('exposes an idle no-op worker health contract', async () => {
    const port = createNoopSolverPort();
    const listenerCalls: string[] = [];
    const unsubscribe = port.subscribeWorkerHealth((health) => {
      listenerCalls.push(health);
    });

    expect(port.getWorkerHealth()).toBe('idle');
    await expect(port.pingWorker()).resolves.toBeUndefined();
    expect(() => port.cancelSolve('run-1')).not.toThrow();
    expect(() => port.retryWorker()).not.toThrow();
    expect(() => port.dispose()).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
    expect(listenerCalls).toEqual([]);
  });

  it('rejects solve requests in environments without a solver worker', async () => {
    const port = createNoopSolverPort();

    await expect(port.startSolve({} as never)).rejects.toThrow(
      'Solver worker is unavailable in this environment.',
    );
  });
});
