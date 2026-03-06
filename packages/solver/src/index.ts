export const solverVersion = '0.0.0';

export type {
  AlgorithmId,
  HeuristicId,
  LevelFeatures,
  Push,
  SolveResult,
  SolveStatus,
  SolverHooks,
  SolverMetrics,
  SolverOptions,
  SolverProgress,
} from './api/solverTypes';
export type { NormalizedSolverOptions } from './api/solverOptions';
export type { SolveContext } from './api/algorithm';

export { normalizeSolverOptions } from './api/solverOptions';
export {
  ALGORITHM_IDS,
  DEFAULT_ALGORITHM_ID,
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLVER_PROGRESS_EXPANDED_INTERVAL,
  DEFAULT_SOLVER_PROGRESS_THROTTLE_MS,
  DEFAULT_SOLVER_TIME_BUDGET_MS,
  HEURISTIC_IDS,
  IMPLEMENTED_ALGORITHM_IDS,
  MAX_HEURISTIC_WEIGHT,
  MIN_HEURISTIC_WEIGHT,
  isImplementedAlgorithmId,
} from './api/solverConstants';
export type { ExpansionStart } from './solution/expandSolution';
export {
  directionsToString,
  expandSolution,
  expandSolutionFromStart,
} from './solution/expandSolution';
export { analyzeLevel, chooseAlgorithm } from './api/selection';
export { solve } from './api/solve';
