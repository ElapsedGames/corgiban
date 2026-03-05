import type {
  BenchProgressMessage,
  BenchResultMessage,
  BenchStartMessage,
  WorkerOutboundMessage,
} from '../protocol/protocol';
import { PROTOCOL_VERSION } from '../protocol/protocol';
import { assertInboundMessage, validateOutboundMessage } from '../protocol/validation';
import { resolveBenchmarkWorkerPoolSize, WorkerPool } from './workerPool.client';

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

type BenchmarkWorkerRunRequest = Omit<BenchStartMessage, 'type' | 'protocolVersion'>;

type BenchmarkWorkerRunCallbacks = {
  onDispatch?: () => void;
  onProgress?: (message: BenchProgressMessage) => void;
};

type BenchmarkWorkerClient = {
  run: (
    request: BenchmarkWorkerRunRequest,
    callbacks?: BenchmarkWorkerRunCallbacks,
  ) => Promise<BenchResultMessage>;
  dispose: () => void;
};

type PendingRun = {
  onProgress?: (message: BenchProgressMessage) => void;
  resolve: (message: BenchResultMessage) => void;
  reject: (error: Error) => void;
};

function defaultWorkerFactory(): WorkerLike {
  const workerCtor = (globalThis as unknown as { Worker: WorkerCtorLike }).Worker;
  const urlCtor = (globalThis as unknown as { URL: UrlCtorLike }).URL;
  return new workerCtor(new urlCtor('../runtime/benchmarkWorker.ts', import.meta.url), {
    type: 'module',
  });
}

function createBenchmarkWorkerClient(createWorker: WorkerFactory): BenchmarkWorkerClient {
  const pendingRuns = new Map<string, PendingRun>();

  let disposed = false;
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

  const rejectAll = (error: Error) => {
    for (const [runId, pending] of pendingRuns.entries()) {
      const wrapped = new Error(`${error.message} (runId: ${runId})`);
      wrapped.name = error.name;
      pending.reject(wrapped);
    }
    pendingRuns.clear();
  };

  const detachWorker = () => {
    if (!worker) {
      return;
    }
    worker.terminate();
    worker = null;
  };

  const failAndReset = (reason: unknown, fallbackMessage: string) => {
    const error = toError(reason, fallbackMessage);
    rejectAll(error);
    detachWorker();
  };

  const handleOutboundMessage = (message: WorkerOutboundMessage) => {
    switch (message.type) {
      case 'BENCH_PROGRESS': {
        pendingRuns.get(message.runId)?.onProgress?.(message);
        return;
      }
      case 'BENCH_RESULT': {
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
        const details = message.details ? ` ${message.details}` : '';
        pending.reject(new Error(`${message.message}${details}`));
        return;
      }
      case 'PONG': {
        return;
      }
      default: {
        failAndReset(
          new Error(`Unexpected outbound message type ${message.type} from benchmark worker.`),
          'Unexpected benchmark worker message.',
        );
      }
    }
  };

  const attachWorkerHandlers = (targetWorker: WorkerLike) => {
    targetWorker.onmessage = (event) => {
      if (worker !== targetWorker || disposed) {
        return;
      }

      const parsed = validateOutboundMessage(event.data);
      if (!parsed.ok) {
        failAndReset(parsed.error, 'Received invalid message from benchmark worker.');
        return;
      }

      handleOutboundMessage(parsed.message);
    };

    targetWorker.onerror = (event) => {
      if (worker !== targetWorker || disposed) {
        return;
      }
      const detail = event.error ?? event.message ?? 'Unknown benchmark worker error.';
      failAndReset(detail, 'Benchmark worker crashed.');
    };

    targetWorker.onmessageerror = () => {
      if (worker !== targetWorker || disposed) {
        return;
      }
      failAndReset('Worker message channel failed.', 'Benchmark worker message channel crashed.');
    };
  };

  const ensureWorker = () => {
    if (worker) {
      return worker;
    }

    const nextWorker = createWorker();
    worker = nextWorker;
    attachWorkerHandlers(nextWorker);
    return nextWorker;
  };

  return {
    run(request, callbacks) {
      if (disposed) {
        return Promise.reject(new Error('Benchmark worker client disposed.'));
      }

      if (pendingRuns.size > 0) {
        return Promise.reject(
          new Error('Benchmark worker client supports one active run per instance.'),
        );
      }

      const startMessage: BenchStartMessage = {
        type: 'BENCH_START',
        runId: request.runId,
        protocolVersion: PROTOCOL_VERSION,
        levelRuntime: request.levelRuntime,
        algorithmId: request.algorithmId,
        ...(request.options ? { options: request.options } : {}),
        ...(request.benchmarkCaseId ? { benchmarkCaseId: request.benchmarkCaseId } : {}),
      };

      try {
        assertInboundMessage(startMessage);
      } catch (error) {
        return Promise.reject(toError(error, 'Invalid BENCH_START message.'));
      }

      return new Promise<BenchResultMessage>((resolve, reject) => {
        pendingRuns.set(request.runId, {
          onProgress: callbacks?.onProgress,
          resolve,
          reject,
        });

        try {
          ensureWorker().postMessage(startMessage);
          callbacks?.onDispatch?.();
        } catch (error) {
          pendingRuns.delete(request.runId);
          failAndReset(error, 'Failed to post BENCH_START.');
          reject(toError(error, 'Failed to post BENCH_START.'));
        }
      });
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      rejectAll(new Error('Benchmark worker client disposed.'));
      detachWorker();
    },
  };
}

export type BenchmarkClientRunRequest = BenchmarkWorkerRunRequest;

export type BenchmarkClientRunCallbacks = {
  onDispatch?: (request: BenchmarkClientRunRequest) => void;
  onProgress?: (message: BenchProgressMessage, request: BenchmarkClientRunRequest) => void;
  onResult?: (message: BenchResultMessage, request: BenchmarkClientRunRequest) => void;
};

export type BenchmarkClientSuiteRequest = {
  runs: BenchmarkClientRunRequest[];
  callbacks?: BenchmarkClientRunCallbacks;
};

export type BenchmarkClient = {
  runSuite: (request: BenchmarkClientSuiteRequest) => Promise<BenchResultMessage[]>;
  cancel: (runId: string) => boolean;
  cancelSuite: () => void;
  dispose: () => void;
  getPoolSize: () => number;
};

export type CreateBenchmarkClientOptions = {
  createWorker?: WorkerFactory;
  createWorkerClient?: () => BenchmarkWorkerClient;
  poolSize?: number;
  hardwareConcurrency?: number;
};

function getNavigatorHardwareConcurrency(): number | undefined {
  const host = globalThis as unknown as { navigator?: { hardwareConcurrency?: number } };
  return host.navigator?.hardwareConcurrency;
}

export function createBenchmarkClient(options?: CreateBenchmarkClientOptions): BenchmarkClient {
  const createWorkerClient =
    options?.createWorkerClient ??
    (() => createBenchmarkWorkerClient(options?.createWorker ?? defaultWorkerFactory));

  const computedPoolSize =
    options?.poolSize ??
    resolveBenchmarkWorkerPoolSize(
      options?.hardwareConcurrency ?? getNavigatorHardwareConcurrency(),
    );

  let disposed = false;
  let suiteGeneration = 0;
  let activeSuiteGeneration: number | null = null;
  let pool = new WorkerPool<BenchmarkWorkerClient, BenchResultMessage>(
    createWorkerClient,
    computedPoolSize,
    (client) => client.dispose(),
  );

  const isGenerationActive = (generation: number) =>
    !disposed && activeSuiteGeneration !== null && activeSuiteGeneration === generation;

  const resetPool = (reason: string) => {
    pool.dispose(reason);
    if (!disposed) {
      pool = new WorkerPool<BenchmarkWorkerClient, BenchResultMessage>(
        createWorkerClient,
        computedPoolSize,
        (client) => client.dispose(),
      );
    }
  };

  return {
    runSuite(request) {
      if (disposed) {
        return Promise.reject(new Error('Benchmark client disposed.'));
      }
      if (activeSuiteGeneration !== null) {
        return Promise.reject(new Error('Benchmark suite is already running.'));
      }

      suiteGeneration += 1;
      const generation = suiteGeneration;
      activeSuiteGeneration = generation;

      const tasks = request.runs.map((runRequest) =>
        pool.enqueue({
          runId: runRequest.runId,
          run: async (workerClient) => {
            const result = await workerClient.run(runRequest, {
              onDispatch: () => {
                if (!isGenerationActive(generation)) {
                  return;
                }
                request.callbacks?.onDispatch?.(runRequest);
              },
              onProgress: (progress) => {
                if (!isGenerationActive(generation)) {
                  return;
                }
                request.callbacks?.onProgress?.(progress, runRequest);
              },
            });
            if (isGenerationActive(generation)) {
              request.callbacks?.onResult?.(result, runRequest);
            }
            return result;
          },
        }),
      );

      return Promise.all(tasks).finally(() => {
        if (activeSuiteGeneration === generation) {
          activeSuiteGeneration = null;
        }
      });
    },
    cancel(runId) {
      if (disposed) {
        return false;
      }
      return pool.cancel(runId);
    },
    cancelSuite() {
      if (disposed) {
        return;
      }
      suiteGeneration += 1;
      activeSuiteGeneration = null;
      resetPool('Benchmark suite cancelled.');
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      suiteGeneration += 1;
      activeSuiteGeneration = null;
      pool.dispose('Benchmark client disposed.');
    },
    getPoolSize() {
      return computedPoolSize;
    },
  };
}
