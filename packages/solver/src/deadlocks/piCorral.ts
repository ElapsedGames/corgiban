import type { ReachabilityResult } from '../infra/reachability';
import type { CompiledLevel } from '../state/compiledLevel';
import type { SolverState } from '../state/solverState';

const OPPOSITE_DIR_INDEX = [1, 0, 3, 2];

export type PiCorralRestriction = {
  allowedPushKeys: Set<number>;
  componentSize: number;
};

function buildComponentIds(
  compiled: CompiledLevel,
  state: SolverState,
  reachability: ReachabilityResult,
): { componentIds: Int32Array; componentSizes: number[] } {
  const componentIds = new Int32Array(compiled.cellCount);
  componentIds.fill(-1);
  const componentSizes: number[] = [];
  const queue = new Uint16Array(compiled.cellCount);

  for (let startCellId = 0; startCellId < compiled.cellCount; startCellId += 1) {
    if (componentIds[startCellId] >= 0) {
      continue;
    }
    if (reachability.reachable.has(startCellId)) {
      continue;
    }
    if (state.occupancy.has(startCellId)) {
      continue;
    }

    const componentIndex = componentSizes.length;
    let head = 0;
    let tail = 0;
    let size = 0;

    componentIds[startCellId] = componentIndex;
    queue[tail] = startCellId;
    tail += 1;

    while (head < tail) {
      const cellId = queue[head];
      head += 1;
      size += 1;

      for (let dirIndex = 0; dirIndex < 4; dirIndex += 1) {
        const nextCellId = compiled.neighbors[cellId * 4 + dirIndex];
        if (nextCellId < 0) {
          continue;
        }
        if (componentIds[nextCellId] >= 0) {
          continue;
        }
        if (reachability.reachable.has(nextCellId)) {
          continue;
        }
        if (state.occupancy.has(nextCellId)) {
          continue;
        }

        componentIds[nextCellId] = componentIndex;
        queue[tail] = nextCellId;
        tail += 1;
      }
    }

    componentSizes.push(size);
  }

  return { componentIds, componentSizes };
}

function collectBoundaryBoxes(
  compiled: CompiledLevel,
  state: SolverState,
  componentIds: Int32Array,
  componentIndex: number,
): number[] {
  const boundaryBoxSet = new Set<number>();

  for (let cellId = 0; cellId < compiled.cellCount; cellId += 1) {
    if (componentIds[cellId] !== componentIndex) {
      continue;
    }

    for (let dirIndex = 0; dirIndex < 4; dirIndex += 1) {
      const neighborCellId = compiled.neighbors[cellId * 4 + dirIndex];
      if (neighborCellId < 0) {
        continue;
      }
      if (!state.occupancy.has(neighborCellId)) {
        continue;
      }
      boundaryBoxSet.add(neighborCellId);
    }
  }

  return Array.from(boundaryBoxSet);
}

function evaluateComponent(
  compiled: CompiledLevel,
  state: SolverState,
  reachability: ReachabilityResult,
  componentIds: Int32Array,
  componentIndex: number,
): Set<number> | undefined {
  const inwardPushes = new Set<number>();
  let outwardPushCount = 0;
  const boundaryBoxes = collectBoundaryBoxes(compiled, state, componentIds, componentIndex);

  for (const boxCellId of boundaryBoxes) {
    for (let dirIndex = 0; dirIndex < 4; dirIndex += 1) {
      const pushFrom = compiled.neighbors[boxCellId * 4 + OPPOSITE_DIR_INDEX[dirIndex]];
      if (pushFrom < 0 || !reachability.reachable.has(pushFrom)) {
        continue;
      }

      const pushTo = compiled.neighbors[boxCellId * 4 + dirIndex];
      if (pushTo < 0 || state.occupancy.has(pushTo) || compiled.deadSquares.has(pushTo)) {
        continue;
      }

      const nextPushKey = boxCellId * 4 + dirIndex;
      if (componentIds[pushTo] === componentIndex) {
        inwardPushes.add(nextPushKey);
      } else {
        outwardPushCount += 1;
      }
    }
  }

  if (inwardPushes.size === 0 || outwardPushCount > 0) {
    return undefined;
  }

  return inwardPushes;
}

export function detectPiCorralRestriction(
  compiled: CompiledLevel,
  state: SolverState,
  reachability: ReachabilityResult,
): PiCorralRestriction | undefined {
  const { componentIds, componentSizes } = buildComponentIds(compiled, state, reachability);
  let bestRestriction: PiCorralRestriction | undefined;

  for (let componentIndex = 0; componentIndex < componentSizes.length; componentIndex += 1) {
    const allowedPushKeys = evaluateComponent(
      compiled,
      state,
      reachability,
      componentIds,
      componentIndex,
    );

    if (!allowedPushKeys) {
      continue;
    }

    const candidate: PiCorralRestriction = {
      allowedPushKeys,
      componentSize: componentSizes[componentIndex],
    };

    if (!bestRestriction) {
      bestRestriction = candidate;
      continue;
    }

    if (candidate.allowedPushKeys.size < bestRestriction.allowedPushKeys.size) {
      bestRestriction = candidate;
      continue;
    }

    if (
      candidate.allowedPushKeys.size === bestRestriction.allowedPushKeys.size &&
      candidate.componentSize > bestRestriction.componentSize
    ) {
      bestRestriction = candidate;
    }
  }

  return bestRestriction;
}
