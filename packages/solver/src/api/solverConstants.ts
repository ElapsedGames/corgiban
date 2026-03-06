export const ALGORITHM_IDS = ['bfsPush', 'astarPush', 'idaStarPush'] as const;

export const IMPLEMENTED_ALGORITHM_IDS = [
  'bfsPush',
] as const satisfies readonly (typeof ALGORITHM_IDS)[number][];

export const HEURISTIC_IDS = ['manhattan', 'assignment'] as const;

export const MIN_HEURISTIC_WEIGHT = 1;
export const MAX_HEURISTIC_WEIGHT = 10;

const implementedAlgorithmSet = new Set<string>(IMPLEMENTED_ALGORITHM_IDS);

export const DEFAULT_ALGORITHM_ID = IMPLEMENTED_ALGORITHM_IDS[0];

export const DEFAULT_SOLVER_TIME_BUDGET_MS = 30_000;
export const DEFAULT_NODE_BUDGET = 2_000_000;
export const DEFAULT_SOLVER_PROGRESS_THROTTLE_MS = 100;
export const DEFAULT_SOLVER_PROGRESS_EXPANDED_INTERVAL = 100;

export function isImplementedAlgorithmId(
  algorithmId: (typeof ALGORITHM_IDS)[number],
): algorithmId is (typeof IMPLEMENTED_ALGORITHM_IDS)[number] {
  return implementedAlgorithmSet.has(algorithmId);
}
