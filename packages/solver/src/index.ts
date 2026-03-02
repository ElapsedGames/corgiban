export const solverVersion = '0.0.0';

export type {
  AlgorithmId,
  HeuristicId,
  Push,
  SolveResult,
  SolveStatus,
  SolverHooks,
  SolverMetrics,
  SolverOptions,
  SolverProgress,
} from './api/solverTypes';
export type { NormalizedSolverOptions } from './api/solverOptions';

export { normalizeSolverOptions } from './api/solverOptions';
export {
  ALGORITHM_IDS,
  HEURISTIC_IDS,
  MAX_HEURISTIC_WEIGHT,
  MIN_HEURISTIC_WEIGHT,
} from './api/solverConstants';
export type { ExpansionStart } from './solution/expandSolution';
export {
  directionsToString,
  expandSolution,
  expandSolutionFromStart,
} from './solution/expandSolution';
