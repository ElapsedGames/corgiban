import type { AlgorithmId } from './solverTypes';
import type { SolverAlgorithm } from './algorithm';
import { astarPushAlgorithm } from '../algorithms/astarPush';
import { bfsPushAlgorithm } from '../algorithms/bfsPush';
import { greedyPushAlgorithm } from '../algorithms/greedyPush';
import { idaStarPushAlgorithm } from '../algorithms/idaStarPush';
import { piCorralPushAlgorithm } from '../algorithms/piCorralPush';
import { tunnelMacroPushAlgorithm } from '../algorithms/tunnelMacroPush';

const registry = new Map<AlgorithmId, SolverAlgorithm>();
registry.set('bfsPush', bfsPushAlgorithm);
registry.set('astarPush', astarPushAlgorithm);
registry.set('idaStarPush', idaStarPushAlgorithm);
registry.set('greedyPush', greedyPushAlgorithm);
registry.set('tunnelMacroPush', tunnelMacroPushAlgorithm);
registry.set('piCorralPush', piCorralPushAlgorithm);

export function getAlgorithm(id: AlgorithmId): SolverAlgorithm | undefined {
  return registry.get(id);
}

export function listAlgorithms(): AlgorithmId[] {
  return Array.from(registry.keys());
}
