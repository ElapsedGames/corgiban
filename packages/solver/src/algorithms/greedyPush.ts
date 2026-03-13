import type { AlgorithmInput, SolverAlgorithm } from '../api/algorithm';
import type { SolveResult } from '../api/solverTypes';
import { solvePriorityPushSearch } from './prioritySearchCore';
import { forEachPushChild } from './searchShared';

function buildGreedyPriority(_depth: number, heuristic: number): number {
  return heuristic;
}

export function solveGreedyPush(input: AlgorithmInput): SolveResult {
  return solvePriorityPushSearch(input, {
    childGenerator: (searchInput, state, visit) => {
      forEachPushChild(searchInput.compiled, state, searchInput.zobrist, visit);
    },
    computePriority: buildGreedyPriority,
    weight: 1,
  });
}

export const greedyPushAlgorithm: SolverAlgorithm = {
  id: 'greedyPush',
  solve: solveGreedyPush,
};
