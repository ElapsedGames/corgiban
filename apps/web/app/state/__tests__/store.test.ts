import { describe, expect, it, vi } from 'vitest';

import type { WorkerHealth } from '../../ports/solverPort';
import type { SolverPort } from '../../ports/solverPort';
import { createAppStore } from '../store';

function createTestSolverPort() {
  const listeners = new Set<(health: WorkerHealth) => void>();
  const unsubscribeSpy = vi.fn();
  const disposeSpy = vi.fn();

  const solverPort: SolverPort = {
    startSolve: async () => {
      throw new Error('not used');
    },
    cancelSolve: () => undefined,
    pingWorker: async () => undefined,
    retryWorker: () => undefined,
    getWorkerHealth: () => 'idle',
    subscribeWorkerHealth: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
        unsubscribeSpy();
      };
    },
    dispose: disposeSpy,
  };

  const emitHealth = (health: WorkerHealth) => {
    for (const listener of listeners) {
      listener(health);
    }
  };

  return {
    solverPort,
    emitHealth,
    unsubscribeSpy,
    disposeSpy,
  };
}

describe('createAppStore', () => {
  it('uses the default noop solver port when none is provided', () => {
    const store = createAppStore();

    expect(store.getState().solver.workerHealth).toBe('idle');
    expect(() => store.dispose()).not.toThrow();
    expect(() => store.dispose()).not.toThrow();
  });

  it('subscribes to worker health and updates the solver state', () => {
    const { solverPort, emitHealth } = createTestSolverPort();
    const store = createAppStore({ solverPort });

    expect(store.getState().solver.workerHealth).toBe('idle');
    emitHealth('healthy');
    expect(store.getState().solver.workerHealth).toBe('healthy');
  });

  it('disposes worker subscriptions and solver port exactly once', () => {
    const { solverPort, emitHealth, unsubscribeSpy, disposeSpy } = createTestSolverPort();
    const store = createAppStore({ solverPort });

    emitHealth('healthy');
    expect(store.getState().solver.workerHealth).toBe('healthy');

    store.dispose();
    store.dispose();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    emitHealth('crashed');
    expect(store.getState().solver.workerHealth).toBe('healthy');
  });
});
