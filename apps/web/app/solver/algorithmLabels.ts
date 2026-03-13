import type { AlgorithmId } from '@corgiban/solver';

export const SOLVER_ALGORITHM_LABELS: Record<AlgorithmId, string> = {
  bfsPush: 'BFS Push',
  astarPush: 'A* Push',
  idaStarPush: 'IDA* Push',
  greedyPush: 'Greedy Push',
  tunnelMacroPush: 'Tunnel Macro Push',
  piCorralPush: 'PI-Corral Push',
};

export function formatSolverAlgorithmLabel(algorithmId: AlgorithmId): string {
  return SOLVER_ALGORITHM_LABELS[algorithmId];
}
