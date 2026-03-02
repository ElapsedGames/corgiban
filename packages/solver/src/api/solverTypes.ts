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

export type SolveResult = {
  status: SolveStatus;
  solutionMoves?: string;
  metrics: SolverMetrics;
};

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
