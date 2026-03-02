import type { AlgorithmId, HeuristicId, SolverOptions } from './solverTypes';
import { MAX_HEURISTIC_WEIGHT, MIN_HEURISTIC_WEIGHT } from './solverConstants';

export type NormalizedSolverOptions = {
  timeBudgetMs?: number;
  nodeBudget?: number;
  heuristicId?: HeuristicId;
  heuristicWeight?: number;
  enableSpectatorStream: boolean;
};

export function normalizeSolverOptions(
  algorithmId: AlgorithmId,
  options: SolverOptions | undefined,
): NormalizedSolverOptions {
  const timeBudgetMs = options?.timeBudgetMs;
  if (timeBudgetMs !== undefined && timeBudgetMs <= 0) {
    throw new Error('timeBudgetMs must be > 0.');
  }

  const nodeBudget = options?.nodeBudget;
  if (nodeBudget !== undefined && nodeBudget <= 0) {
    throw new Error('nodeBudget must be > 0.');
  }

  const enableSpectatorStream = options?.enableSpectatorStream ?? false;

  const heuristicWeight = options?.heuristicWeight;
  if (
    heuristicWeight !== undefined &&
    (heuristicWeight < MIN_HEURISTIC_WEIGHT || heuristicWeight > MAX_HEURISTIC_WEIGHT)
  ) {
    throw new Error(
      `heuristicWeight must be between ${MIN_HEURISTIC_WEIGHT} and ${MAX_HEURISTIC_WEIGHT}.`,
    );
  }

  if (algorithmId === 'bfsPush') {
    if (options?.heuristicId !== undefined || options?.heuristicWeight !== undefined) {
      throw new Error('heuristicId/heuristicWeight are not supported for bfsPush.');
    }
    return {
      timeBudgetMs,
      nodeBudget,
      heuristicId: undefined,
      heuristicWeight: undefined,
      enableSpectatorStream,
    };
  }

  const heuristicId = options?.heuristicId ?? 'manhattan';
  const normalizedWeight = heuristicWeight ?? 1;

  return {
    timeBudgetMs,
    nodeBudget,
    heuristicId,
    heuristicWeight: normalizedWeight,
    enableSpectatorStream,
  };
}
