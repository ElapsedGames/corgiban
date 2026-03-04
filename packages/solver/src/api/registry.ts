import type { AlgorithmId } from './solverTypes';
import type { SolverAlgorithm } from './algorithm';
import { bfsPushAlgorithm } from '../algorithms/bfsPush';

const registry = new Map<AlgorithmId, SolverAlgorithm>();
registry.set('bfsPush', bfsPushAlgorithm);

export function getAlgorithm(id: AlgorithmId): SolverAlgorithm | undefined {
  return registry.get(id);
}

export function listAlgorithms(): AlgorithmId[] {
  return Array.from(registry.keys());
}
