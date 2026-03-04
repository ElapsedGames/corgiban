import { solve } from '@corgiban/solver';

import type {
  SolveErrorMessage,
  SolveProgressMessage,
  SolveResultMessage,
  SolveStartMessage,
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

type ActiveSolveRun = {
  runId: string;
};

let activeRun: ActiveSolveRun | null = null;

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

function toProgressMessage(
  runId: string,
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
): SolveProgressMessage {
  return {
    type: 'SOLVE_PROGRESS',
    runId,
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
  };
}

function runSolve(message: SolveStartMessage): void {
  activeRun = { runId: message.runId };

  const streamBestPath = message.options?.enableSpectatorStream === true;
  const throttle = createProgressThrottle();

  try {
    const result = solve(
      message.levelRuntime,
      message.algorithmId,
      message.options,
      {
        onProgress: (progress) => {
          if (activeRun?.runId !== message.runId) {
            return;
          }
          if (!throttle.shouldEmit(progress)) {
            return;
          }
          postMessageValidated(toProgressMessage(message.runId, progress, streamBestPath));
        },
      },
      {
        nowMs,
        progressThrottleMs: 0,
        progressExpandedInterval: 1,
      },
    );

    if (activeRun?.runId !== message.runId) {
      return;
    }

    const resultMessage: SolveResultMessage =
      result.status === 'error'
        ? {
            type: 'SOLVE_RESULT',
            runId: message.runId,
            protocolVersion: PROTOCOL_VERSION,
            status: 'error',
            metrics: result.metrics,
            errorMessage: result.errorMessage,
            ...(result.errorDetails ? { errorDetails: result.errorDetails } : {}),
          }
        : {
            type: 'SOLVE_RESULT',
            runId: message.runId,
            protocolVersion: PROTOCOL_VERSION,
            status: result.status,
            metrics: result.metrics,
            ...(result.solutionMoves !== undefined ? { solutionMoves: result.solutionMoves } : {}),
          };
    postMessageValidated(resultMessage);
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown solver worker failure.';
    postSolveError(message.runId, 'Failed to execute solve run.', details);
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
    case 'SOLVE_START': {
      runSolve(message);
      return;
    }
    default: {
      const unsupported: never = message;
      throw new Error(`Unsupported inbound message ${(unsupported as { type: string }).type}.`);
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
