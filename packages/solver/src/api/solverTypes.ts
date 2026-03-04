import type { Direction } from '@corgiban/shared';

import { ALGORITHM_IDS, HEURISTIC_IDS } from './solverConstants';

export type AlgorithmId = (typeof ALGORITHM_IDS)[number];

export type HeuristicId = (typeof HEURISTIC_IDS)[number];

export type Push = {
  // boxIndex is a flat grid index (LevelRuntime index), not a boxes-array slot.
  boxIndex: number;
  direction: Direction;
};

export type SolverOptions = {
  timeBudgetMs?: number;
  nodeBudget?: number;
  heuristicId?: HeuristicId;
  heuristicWeight?: number;
  enableSpectatorStream?: boolean;
};

export type SolverMetrics = {
  elapsedMs: number;
  expanded: number;
  generated: number;
  maxDepth: number;
  maxFrontier: number;
  pushCount: number;
  moveCount: number;
};

export type SolveStatus = 'solved' | 'unsolved' | 'timeout' | 'cancelled' | 'error';

export type SolveSuccessResult = {
  status: 'solved';
  solutionMoves: string;
  metrics: SolverMetrics;
};

export type SolveNonErrorResult = {
  status: 'unsolved' | 'timeout' | 'cancelled';
  solutionMoves?: string;
  metrics: SolverMetrics;
};

export type SolveErrorResult = {
  status: 'error';
  metrics: SolverMetrics;
  errorMessage: string;
  errorDetails?: string;
};

export type SolveResult = SolveSuccessResult | SolveNonErrorResult | SolveErrorResult;

export type SolverProgress = {
  expanded: number;
  generated: number;
  depth: number;
  frontier: number;
  elapsedMs: number;
  bestHeuristic?: number;
  bestPathSoFar?: string;
};

export type SolverHooks = {
  onProgress?: (progress: SolverProgress) => void;
};

export type LevelFeatures = {
  width: number;
  height: number;
  boxCount: number;
  walkableCount: number;
  reachableCount: number;
};
