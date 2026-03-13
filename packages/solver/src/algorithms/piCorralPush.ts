import type { AlgorithmInput, SolverAlgorithm } from '../api/algorithm';
import type { SolveResult } from '../api/solverTypes';
import { solvePriorityPushSearch } from './prioritySearchCore';
import { forEachPiCorralChild } from './searchShared';

function buildWeightedPriority(depth: number, heuristic: number, weight: number): number {
  return depth + heuristic * weight;
}

export function solvePiCorralPush(input: AlgorithmInput): SolveResult {
  return solvePriorityPushSearch(input, {
    childGenerator: (searchInput, state, visit) => {
      forEachPiCorralChild(searchInput.compiled, state, searchInput.zobrist, visit);
    },
    computePriority: buildWeightedPriority,
  });
}

export const piCorralPushAlgorithm: SolverAlgorithm = {
  id: 'piCorralPush',
  solve: solvePiCorralPush,
};
