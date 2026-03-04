import type { LevelRuntime } from '@corgiban/core';
import type { AlgorithmId, SolveStatus, SolverMetrics, SolverOptions } from '@corgiban/solver';

export type WorkerHealth = 'idle' | 'healthy' | 'crashed';

export type SolverProgress = {
  runId: string;
  expanded: number;
  generated: number;
  depth: number;
  frontier: number;
  elapsedMs: number;
  bestHeuristic?: number;
  bestPathSoFar?: string;
};

export type SolverRunResult = {
  runId: string;
  algorithmId: AlgorithmId;
  status: SolveStatus;
  solutionMoves?: string;
  errorMessage?: string;
  errorDetails?: string;
  metrics: SolverMetrics;
};

export type StartSolveRequest = {
  runId: string;
  levelRuntime: LevelRuntime;
  algorithmId: AlgorithmId;
  options?: SolverOptions;
  onProgress?: (progress: SolverProgress) => void;
};

export type SolverPort = {
  startSolve: (request: StartSolveRequest) => Promise<SolverRunResult>;
  cancelSolve: (runId: string) => void;
  pingWorker: () => Promise<void>;
  retryWorker: () => void;
  getWorkerHealth: () => WorkerHealth;
  subscribeWorkerHealth: (listener: (health: WorkerHealth) => void) => () => void;
  dispose: () => void;
};

export function createNoopSolverPort(): SolverPort {
  return {
    startSolve: async () => {
      throw new Error('Solver worker is unavailable in this environment.');
    },
    cancelSolve: () => undefined,
    pingWorker: async () => undefined,
    retryWorker: () => undefined,
    getWorkerHealth: () => 'idle',
    subscribeWorkerHealth: () => () => undefined,
    dispose: () => undefined,
  };
}
