import { solve } from '@corgiban/solver';

import type {
  BenchProgressMessage,
  BenchResultMessage,
  BenchStartMessage,
  SolveErrorMessage,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from '../protocol/protocol';
import { PROTOCOL_VERSION } from '../protocol/protocol';
import { assertOutboundMessage, validateInboundMessage } from '../protocol/validation';
import { createProgressThrottle } from './throttle';

type WorkerMessageEventLike = {
  data: unknown;
};

type WorkerScopeLike = {
  addEventListener: (type: 'message', listener: (event: WorkerMessageEventLike) => void) => void;
  postMessage: (message: unknown) => void;
  performance?: {
    now: () => number;
  };
};

const workerScope = globalThis as unknown as WorkerScopeLike;

type ActiveBenchmarkRun = {
  runId: string;
};

let activeRun: ActiveBenchmarkRun | null = null;
const BENCH_SPECTATOR_PROGRESS_MIN_INTERVAL_MS = 100;
const BENCH_SPECTATOR_PROGRESS_MIN_EXPANDED_DELTA = Number.MAX_SAFE_INTEGER;

function nowMs(): number {
  return workerScope.performance?.now() ?? 0;
}

function getRunIdCandidate(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'runId' in payload) {
    const runId = (payload as { runId: unknown }).runId;
    if (typeof runId === 'string' && runId.length > 0) {
      return runId;
    }
  }
  return 'invalid-run';
}

function postMessageValidated(message: WorkerOutboundMessage): void {
  assertOutboundMessage(message);
  workerScope.postMessage(message);
}

function postSolveError(runId: string, message: string, details?: string): void {
  const errorMessage: SolveErrorMessage = {
    type: 'SOLVE_ERROR',
    runId,
    protocolVersion: PROTOCOL_VERSION,
    message,
    ...(details ? { details } : {}),
  };
  postMessageValidated(errorMessage);
}

function toBenchProgressMessage(
  message: BenchStartMessage,
  progress: {
    expanded: number;
    generated: number;
    depth: number;
    frontier: number;
    elapsedMs: number;
    bestHeuristic?: number;
    bestPathSoFar?: string;
  },
  includeBestPath: boolean,
): BenchProgressMessage {
  return {
    type: 'BENCH_PROGRESS',
    runId: message.runId,
    protocolVersion: PROTOCOL_VERSION,
    expanded: progress.expanded,
    generated: progress.generated,
    depth: progress.depth,
    frontier: progress.frontier,
    elapsedMs: progress.elapsedMs,
    ...(progress.bestHeuristic !== undefined ? { bestHeuristic: progress.bestHeuristic } : {}),
    ...(includeBestPath && progress.bestPathSoFar !== undefined
      ? { bestPathSoFar: progress.bestPathSoFar }
      : {}),
    ...(message.benchmarkCaseId ? { benchmarkCaseId: message.benchmarkCaseId } : {}),
  };
}

function runBenchmark(message: BenchStartMessage): void {
  activeRun = { runId: message.runId };
  const streamBestPath = message.options?.enableSpectatorStream === true;
  const throttle = createProgressThrottle(
    streamBestPath
      ? {
          minIntervalMs: BENCH_SPECTATOR_PROGRESS_MIN_INTERVAL_MS,
          minExpandedDelta: BENCH_SPECTATOR_PROGRESS_MIN_EXPANDED_DELTA,
        }
      : undefined,
  );

  // Only emit BENCH_PROGRESS when spectator streaming is explicitly requested.
  // Without a consumer, emitting every node expansion wastes protocol overhead.
  try {
    const result = solve(
      message.levelRuntime,
      message.algorithmId,
      message.options,
      streamBestPath
        ? {
            onProgress: (progress) => {
              if (activeRun?.runId !== message.runId) {
                return;
              }
              if (!throttle.shouldEmit(progress)) {
                return;
              }
              postMessageValidated(toBenchProgressMessage(message, progress, true));
            },
          }
        : undefined,
      streamBestPath ? { nowMs, progressThrottleMs: 0, progressExpandedInterval: 1 } : { nowMs },
    );

    if (activeRun?.runId !== message.runId) {
      return;
    }

    const resultMessage: BenchResultMessage =
      result.status === 'error'
        ? {
            type: 'BENCH_RESULT',
            runId: message.runId,
            protocolVersion: PROTOCOL_VERSION,
            status: 'error',
            metrics: result.metrics,
            errorMessage: result.errorMessage,
            ...(result.errorDetails ? { errorDetails: result.errorDetails } : {}),
            ...(message.benchmarkCaseId ? { benchmarkCaseId: message.benchmarkCaseId } : {}),
          }
        : {
            type: 'BENCH_RESULT',
            runId: message.runId,
            protocolVersion: PROTOCOL_VERSION,
            status: result.status,
            metrics: result.metrics,
            ...(result.solutionMoves !== undefined ? { solutionMoves: result.solutionMoves } : {}),
            ...(message.benchmarkCaseId ? { benchmarkCaseId: message.benchmarkCaseId } : {}),
          };

    postMessageValidated(resultMessage);
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown benchmark worker failure.';
    postSolveError(message.runId, 'Failed to execute benchmark run.', details);
  } finally {
    if (activeRun?.runId === message.runId) {
      activeRun = null;
    }
  }
}

function handleInboundMessage(message: WorkerInboundMessage): void {
  switch (message.type) {
    case 'PING': {
      postMessageValidated({
        type: 'PONG',
        protocolVersion: PROTOCOL_VERSION,
      });
      return;
    }
    case 'BENCH_START': {
      runBenchmark(message);
      return;
    }
    default: {
      const type = (message as { type: string }).type;
      postSolveError(
        getRunIdCandidate(message),
        `Unsupported inbound message ${type} for benchmark worker.`,
      );
    }
  }
}

workerScope.addEventListener('message', (event) => {
  const validation = validateInboundMessage(event.data);
  if (!validation.ok) {
    postSolveError(
      getRunIdCandidate(event.data),
      'Invalid inbound protocol message.',
      validation.error.message,
    );
    return;
  }

  handleInboundMessage(validation.message);
});
