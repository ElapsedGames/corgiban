import type { AlgorithmId } from '@corgiban/solver';

export const SOLVER_ALGORITHM_LABELS: Record<AlgorithmId, string> = {
  bfsPush: 'BFS Push',
  astarPush: 'A-Star Push',
  idaStarPush: 'IDA-Star Push',
  greedyPush: 'Greedy Push',
  tunnelMacroPush: 'Tunnel Macro Push',
  piCorralPush: 'PI-Corral Push',
};

export const SOLVER_ALGORITHM_DESCRIPTIONS: Record<AlgorithmId, string> = {
  bfsPush:
    'Breadth-first search checks the simplest push plans first. It is steady and reliable, but it can get slow on larger puzzles.',
  astarPush:
    'A-star search uses a score to guess which pushes are most promising. It usually reaches good answers faster than breadth-first search.',
  idaStarPush:
    'IDA-star search repeats a depth-first search with tighter score limits. It saves memory, but it may repeat work to find a solution.',
  greedyPush:
    'Greedy search always follows the move that looks best right now. It can be fast, but it is less careful and may miss better paths.',
  tunnelMacroPush:
    'Tunnel Macro search groups forced tunnel moves together. That cuts down busywork in narrow spaces and can speed up puzzle solving.',
  piCorralPush:
    'PI-Corral search looks for boxed-in areas that strongly limit what matters next. It can prune hard puzzles well, but the extra checks cost work.',
};

export function formatSolverAlgorithmLabel(algorithmId: AlgorithmId): string {
  return SOLVER_ALGORITHM_LABELS[algorithmId];
}

export function formatSolverAlgorithmDescription(algorithmId: AlgorithmId): string {
  return SOLVER_ALGORITHM_DESCRIPTIONS[algorithmId];
}
