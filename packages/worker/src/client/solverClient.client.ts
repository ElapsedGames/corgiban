import type {
  SolveProgressMessage,
  SolveResultMessage,
  SolveStartMessage,
} from '../protocol/protocol';
import { PROTOCOL_VERSION } from '../protocol/protocol';
import type { ValidateOutboundMessageOptions } from '../protocol/validation';
import { assertInboundMessage, validateOutboundMessage } from '../protocol/validation';

type WorkerLike = {
  onmessage: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onmessageerror: ((event: any) => void) | null;
  postMessage: (message: unknown) => void;
  terminate: () => void;
};

type WorkerFactory = () => WorkerLike;

type WorkerCtorLike = new (url: unknown, options?: { type?: 'module' }) => WorkerLike;
type UrlCtorLike = new (path: string, base: string) => unknown;

function defaultWorkerFactory(): WorkerLike {
  const workerCtor = (globalThis as unknown as { Worker: WorkerCtorLike }).Worker;
  const urlCtor = (globalThis as unknown as { URL: UrlCtorLike }).URL;
  return new workerCtor(new urlCtor('../runtime/solverWorker.ts', import.meta.url), {
    type: 'module',
  });
}

export type SolverWorkerHealth = 'idle' | 'healthy' | 'crashed';

type PendingRun = {
  onProgress?: (message: SolveProgressMessage) => void;
  resolve: (message: SolveResultMessage) => void;
  reject: (error: Error) => void;
};

type PendingPing = {
  resolve: () => void;
  reject: (error: Error) => void;
};

export type SolverClientSolveRequest = Omit<SolveStartMessage, 'type' | 'protocolVersion'>;

export type SolverClient = {
  solve: (
    request: SolverClientSolveRequest,
    callbacks?: { onProgress?: (message: SolveProgressMessage) => void },
  ) => Promise<SolveResultMessage>;
  cancel: (runId: string) => void;
  ping: () => Promise<void>;
  retry: () => void;
  dispose: () => void;
  getWorkerHealth: () => SolverWorkerHealth;
  subscribeWorkerHealth: (listener: (health: SolverWorkerHealth) => void) => () => void;
};

export type CreateSolverClientOptions = {
  createWorker?: WorkerFactory;
  outboundValidationMode?: ValidateOutboundMessageOptions['mode'];
};

export function createSolverClient(options?: CreateSolverClientOptions): SolverClient {
  const createWorker = options?.createWorker ?? defaultWorkerFactory;
  const outboundValidationOptions: ValidateOutboundMessageOptions | undefined =
    options?.outboundValidationMode === 'light-progress' ? { mode: 'light-progress' } : undefined;

  const healthListeners = new Set<(health: SolverWorkerHealth) => void>();
  const pendingRuns = new Map<string, PendingRun>();

  let pendingPing: PendingPing | null = null;
  let workerHealth: SolverWorkerHealth = 'idle';
  let worker: WorkerLike | null = null;

  const toError = (reason: unknown, fallbackMessage: string): Error => {
    if (reason instanceof Error) {
      return reason;
    }
    if (typeof reason === 'string') {
      return new Error(reason);
    }
    return new Error(fallbackMessage);
  };

  const toRunError = (message: string, runId: string, name?: string): Error => {
    const error = new Error(`${message} (runId: ${runId})`);
    if (name) {
      error.name = name;
    }
    return error;
  };

  const setWorkerHealth = (next: SolverWorkerHealth) => {
    if (workerHealth === next) {
      return;
    }
    workerHealth = next;
    for (const listener of healthListeners) {
      listener(next);
    }
  };

  const rejectAllPendingRuns = (error: Error) => {
    for (const [runId, pending] of pendingRuns.entries()) {
      pending.reject(toRunError(error.message, runId, error.name));
    }
    pendingRuns.clear();
  };

  const rejectPendingPing = (error: Error) => {
    if (!pendingPing) {
      return;
    }
    pendingPing.reject(error);
    pendingPing = null;
  };

  const handleWorkerCrash = (reason: unknown, fallbackMessage: string) => {
    const error = toError(reason, fallbackMessage);
    setWorkerHealth('crashed');
    rejectAllPendingRuns(error);
    rejectPendingPing(error);
  };

  const attachWorkerHandlers = (targetWorker: WorkerLike) => {
    targetWorker.onmessage = (event) => {
      if (worker !== targetWorker) {
        return;
      }
      const parsed = validateOutboundMessage(event.data, outboundValidationOptions);
      if (!parsed.ok) {
        handleWorkerCrash(parsed.error, 'Received invalid message from solver worker.');
        return;
      }

      setWorkerHealth('healthy');
      const message = parsed.message;

      switch (message.type) {
        case 'SOLVE_PROGRESS': {
          const pending = pendingRuns.get(message.runId);
          pending?.onProgress?.(message);
          return;
        }
        case 'SOLVE_RESULT': {
          const pending = pendingRuns.get(message.runId);
          if (!pending) {
            return;
          }
          pendingRuns.delete(message.runId);
          pending.resolve(message);
          return;
        }
        case 'SOLVE_ERROR': {
          const pending = pendingRuns.get(message.runId);
          if (!pending) {
            return;
          }
          pendingRuns.delete(message.runId);
          const detailsText = message.details ? ` ${message.details}` : '';
          pending.reject(new Error(`${message.message}${detailsText}`));
          return;
        }
        case 'PONG': {
          pendingPing?.resolve();
          pendingPing = null;
          return;
        }
        default: {
          return;
        }
      }
    };

    targetWorker.onerror = (event) => {
      if (worker !== targetWorker) {
        return;
      }
      const detail = event.error ?? event.message ?? 'Unknown worker error.';
      handleWorkerCrash(detail, 'Solver worker crashed.');
    };

    targetWorker.onmessageerror = () => {
      if (worker !== targetWorker) {
        return;
      }
      handleWorkerCrash('Worker message channel failed.', 'Solver worker message channel crashed.');
    };
  };

  const ensureWorker = (): WorkerLike => {
    if (worker) {
      return worker;
    }

    const nextWorker = createWorker();
    worker = nextWorker;
    attachWorkerHandlers(nextWorker);
    return nextWorker;
  };

  const clearPendingBeforeReset = (message: string) => {
    const resetError = new Error(message);
    rejectAllPendingRuns(resetError);
    rejectPendingPing(resetError);
  };

  const recreateWorker = (message = 'Solver worker was reset.') => {
    clearPendingBeforeReset(message);
    if (worker) {
      worker.terminate();
    }
    worker = createWorker();
    attachWorkerHandlers(worker);
    setWorkerHealth('idle');
  };

  return {
    solve(request, callbacks) {
      if (workerHealth === 'crashed') {
        return Promise.reject(new Error('Solver worker is crashed. Retry worker before solving.'));
      }

      const startMessage: SolveStartMessage = {
        type: 'SOLVE_START',
        runId: request.runId,
        protocolVersion: PROTOCOL_VERSION,
        levelRuntime: request.levelRuntime,
        algorithmId: request.algorithmId,
        ...(request.options ? { options: request.options } : {}),
      };

      try {
        assertInboundMessage(startMessage);
      } catch (error) {
        return Promise.reject(toError(error, 'Invalid SOLVE_START message.'));
      }

      if (pendingRuns.size > 0) {
        const activeRunId = pendingRuns.keys().next().value as string;
        return Promise.reject(
          new Error(
            `Solver client supports one active run per instance. Active runId: ${activeRunId}.`,
          ),
        );
      }

      return new Promise<SolveResultMessage>((resolve, reject) => {
        pendingRuns.set(request.runId, {
          onProgress: callbacks?.onProgress,
          resolve,
          reject,
        });

        try {
          ensureWorker().postMessage(startMessage);
        } catch (error) {
          pendingRuns.delete(request.runId);
          const postError = toError(error, 'Failed to post SOLVE_START.');
          handleWorkerCrash(postError, postError.message);
          reject(postError);
        }
      });
    },
    cancel(runId) {
      const pending = pendingRuns.get(runId);
      if (pending) {
        pendingRuns.delete(runId);
        pending.reject(
          toRunError('Solver run cancelled by user.', runId, 'SolverRunCancelledError'),
        );
      }
      recreateWorker('Solver worker was reset after cancellation.');
    },
    ping() {
      if (workerHealth === 'crashed') {
        return Promise.reject(new Error('Solver worker is crashed. Retry worker before pinging.'));
      }
      if (pendingPing) {
        return Promise.reject(new Error('Solver worker ping already in flight.'));
      }

      const pingMessage = {
        type: 'PING' as const,
        protocolVersion: PROTOCOL_VERSION,
      };
      try {
        assertInboundMessage(pingMessage);
      } catch (error) {
        return Promise.reject(toError(error, 'Invalid PING message.'));
      }

      return new Promise<void>((resolve, reject) => {
        pendingPing = { resolve, reject };
        try {
          ensureWorker().postMessage(pingMessage);
        } catch (error) {
          const postError = toError(error, 'Failed to post PING.');
          rejectPendingPing(postError);
          handleWorkerCrash(postError, postError.message);
          reject(postError);
        }
      });
    },
    retry() {
      recreateWorker();
    },
    dispose() {
      clearPendingBeforeReset('Solver client disposed.');
      if (worker) {
        worker.terminate();
        worker = null;
      }
      setWorkerHealth('idle');
    },
    getWorkerHealth() {
      return workerHealth;
    },
    subscribeWorkerHealth(listener) {
      healthListeners.add(listener);
      return () => {
        healthListeners.delete(listener);
      };
    },
  };
}
