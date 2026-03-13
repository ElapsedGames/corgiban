import type { AlgorithmInput, SolverAlgorithm } from '../api/algorithm';
import type { SolveResult } from '../api/solverTypes';
import { solvePriorityPushSearch } from './prioritySearchCore';
import { forEachTunnelMacroChild } from './searchShared';

function buildWeightedPriority(depth: number, heuristic: number, weight: number): number {
  return depth + heuristic * weight;
}

export function solveTunnelMacroPush(input: AlgorithmInput): SolveResult {
  return solvePriorityPushSearch(input, {
    childGenerator: (searchInput, state, visit) => {
      forEachTunnelMacroChild(searchInput.compiled, state, searchInput.zobrist, visit);
    },
    computePriority: buildWeightedPriority,
  });
}

export const tunnelMacroPushAlgorithm: SolverAlgorithm = {
  id: 'tunnelMacroPush',
  solve: solveTunnelMacroPush,
};
