import { createNoopBenchmarkPort, type BenchmarkPort } from '../ports/benchmarkPort';
import { createNoopPersistencePort, type PersistencePort } from '../ports/persistencePort';
import { createNoopSolverPort, type SolverPort, type WorkerHealth } from '../ports/solverPort';

export type MutableSolverPort = SolverPort & {
  replace: (next: SolverPort) => void;
};

export type MutableBenchmarkPort = BenchmarkPort & {
  replace: (next: BenchmarkPort) => void;
};

export type MutablePersistencePort = PersistencePort & {
  replace: (next: PersistencePort) => void;
};

export function createMutableSolverPort(
  initial: SolverPort = createNoopSolverPort(),
): MutableSolverPort {
  let current = initial;
  let disposed = false;
  let unsubscribeCurrent: (() => void) | null = null;
  const listeners = new Set<(health: WorkerHealth) => void>();

  const unsubscribeFromCurrent = () => {
    unsubscribeCurrent?.();
    unsubscribeCurrent = null;
  };

  const subscribeToCurrent = () => {
    if (disposed || listeners.size === 0 || unsubscribeCurrent) {
      return;
    }

    unsubscribeCurrent = current.subscribeWorkerHealth((health) => {
      listeners.forEach((listener) => {
        listener(health);
      });
    });
  };

  const notifyCurrentHealth = () => {
    const health = current.getWorkerHealth();
    listeners.forEach((listener) => {
      listener(health);
    });
  };

  return {
    startSolve(request) {
      return current.startSolve(request);
    },
    cancelSolve(runId) {
      current.cancelSolve(runId);
    },
    pingWorker() {
      return current.pingWorker();
    },
    retryWorker() {
      current.retryWorker();
    },
    getWorkerHealth() {
      return current.getWorkerHealth();
    },
    subscribeWorkerHealth(listener) {
      if (disposed) {
        return () => undefined;
      }

      listeners.add(listener);
      subscribeToCurrent();

      return () => {
        if (!listeners.delete(listener) || listeners.size > 0) {
          return;
        }

        unsubscribeFromCurrent();
      };
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      listeners.clear();
      unsubscribeFromCurrent();
      current.dispose();
    },
    replace(next) {
      if (disposed) {
        next.dispose();
        return;
      }

      const previous = current;
      current = next;
      unsubscribeFromCurrent();
      subscribeToCurrent();
      notifyCurrentHealth();
      previous.dispose();
    },
  };
}

export function createMutableBenchmarkPort(
  initial: BenchmarkPort = createNoopBenchmarkPort(),
): MutableBenchmarkPort {
  let current = initial;
  let disposed = false;

  return {
    runSuite(request) {
      return current.runSuite(request);
    },
    cancelSuite(suiteRunId) {
      current.cancelSuite(suiteRunId);
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      current.dispose();
    },
    replace(next) {
      if (disposed) {
        next.dispose();
        return;
      }

      const previous = current;
      current = next;
      previous.dispose();
    },
  };
}

export function createMutablePersistencePort(
  initial: PersistencePort = createNoopPersistencePort(),
): MutablePersistencePort {
  let current = initial;
  let disposed = false;

  return {
    init() {
      return current.init();
    },
    loadResults() {
      return current.loadResults();
    },
    saveResult(result) {
      return current.saveResult(result);
    },
    replaceResults(results) {
      return current.replaceResults(results);
    },
    clearResults() {
      return current.clearResults();
    },
    getRepositoryHealth() {
      return current.getRepositoryHealth();
    },
    getLastRepositoryError() {
      return current.getLastRepositoryError();
    },
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      current.dispose();
    },
    replace(next) {
      if (disposed) {
        next.dispose();
        return;
      }

      const previous = current;
      current = next;
      previous.dispose();
    },
  };
}
