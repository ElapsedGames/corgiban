import { createSolverClient } from '@corgiban/worker';
import solverWorkerUrl from './solverWorker.client.ts?worker&url';

import type { SolverPort, StartSolveRequest } from './solverPort';

function createAppSolverWorker() {
  if (solverWorkerUrl.length === 0) {
    throw new Error('Solver worker URL resolved to an empty string.');
  }

  return new Worker(solverWorkerUrl, { type: 'module', name: 'corgiban-solver' });
}

function readLightProgressValidationEnv(): boolean {
  const raw = import.meta.env?.VITE_WORKER_LIGHT_PROGRESS_VALIDATION;
  if (raw === true || raw === 'true' || raw === 'TRUE' || raw === '1') {
    return true;
  }
  return false;
}

function mapProgressMessage(
  runId: string,
  message: {
    expanded: number;
    generated: number;
    depth: number;
    frontier: number;
    elapsedMs: number;
    bestHeuristic?: number;
    bestPathSoFar?: string;
  },
) {
  return {
    runId,
    expanded: message.expanded,
    generated: message.generated,
    depth: message.depth,
    frontier: message.frontier,
    elapsedMs: message.elapsedMs,
    ...(message.bestHeuristic !== undefined ? { bestHeuristic: message.bestHeuristic } : {}),
    ...(message.bestPathSoFar !== undefined ? { bestPathSoFar: message.bestPathSoFar } : {}),
  };
}

export function createSolverPort(): SolverPort {
  const client = createSolverClient({
    createWorker: createAppSolverWorker,
    outboundValidationMode: readLightProgressValidationEnv() ? 'light-progress' : 'strict',
  });

  return {
    async startSolve(request: StartSolveRequest) {
      const result = await client.solve(
        {
          runId: request.runId,
          levelRuntime: request.levelRuntime,
          algorithmId: request.algorithmId,
          ...(request.options ? { options: request.options } : {}),
        },
        {
          onProgress: (message) => {
            request.onProgress?.(mapProgressMessage(request.runId, message));
          },
        },
      );

      if (result.status === 'error') {
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: result.status,
          errorMessage: result.errorMessage,
          ...(result.errorDetails !== undefined ? { errorDetails: result.errorDetails } : {}),
          metrics: result.metrics,
        };
      }

      return {
        runId: request.runId,
        algorithmId: request.algorithmId,
        status: result.status,
        ...(result.solutionMoves !== undefined ? { solutionMoves: result.solutionMoves } : {}),
        metrics: result.metrics,
      };
    },
    cancelSolve(runId: string) {
      client.cancel(runId);
    },
    async pingWorker() {
      await client.ping();
    },
    retryWorker() {
      client.retry();
    },
    getWorkerHealth() {
      return client.getWorkerHealth();
    },
    subscribeWorkerHealth(listener) {
      return client.subscribeWorkerHealth(listener);
    },
    dispose() {
      client.dispose();
    },
  };
}
