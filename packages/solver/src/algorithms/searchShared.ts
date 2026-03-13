import type { CompiledLevel } from '../state/compiledLevel';
import { DIRECTION_ORDER, globalIndexFromCell, hasTunnelDirection } from '../state/compiledLevel';
import type { SolverState } from '../state/solverState';
import { createSolverState, fingerprintFromState } from '../state/solverState';
import { computeReachability } from '../infra/reachability';
import type { ZobristTable } from '../infra/zobrist';
import type { CancelToken } from '../infra/cancelToken';
import type { Push, SolverMetrics, SolverProgress } from '../api/solverTypes';
import type { AlgorithmInput } from '../api/algorithm';
import { estimateAssignmentCost } from '../heuristics/assignment';
import { estimateManhattanCost } from '../heuristics/manhattan';
import { detectPiCorralRestriction } from '../deadlocks/piCorral';

const OPPOSITE_DIR_INDEX = [1, 0, 3, 2];

export type SearchChild = {
  state: SolverState;
  push: Push;
  pushes?: Push[];
};

export function isSolved(compiled: AlgorithmInput['compiled'], boxes: Uint16Array): boolean {
  if (boxes.length === 0) {
    return true;
  }

  for (let index = 0; index < boxes.length; index += 1) {
    if (!compiled.goals.has(boxes[index])) {
      return false;
    }
  }

  return true;
}

export function buildMetrics(
  elapsedMs: number,
  expanded: number,
  generated: number,
  maxDepth: number,
  maxFrontier: number,
  pushCount: number,
  moveCount: number,
): SolverMetrics {
  return {
    elapsedMs,
    expanded,
    generated,
    maxDepth,
    maxFrontier,
    pushCount,
    moveCount,
  };
}

export function buildProgress(
  expanded: number,
  generated: number,
  depth: number,
  frontier: number,
  elapsedMs: number,
  bestHeuristic?: number,
  bestPathSoFar?: string,
): SolverProgress {
  return {
    expanded,
    generated,
    depth,
    frontier,
    elapsedMs,
    ...(bestHeuristic !== undefined ? { bestHeuristic } : {}),
    ...(bestPathSoFar !== undefined ? { bestPathSoFar } : {}),
  };
}

export function shouldCancel(token: CancelToken | undefined): boolean {
  return token ? token.isCancelled() : false;
}

export function estimateHeuristic(input: AlgorithmInput, boxes: Uint16Array): number {
  if (input.options.heuristicId === 'assignment') {
    return estimateAssignmentCost(input.compiled, boxes);
  }

  return estimateManhattanCost(input.compiled, boxes);
}

function buildPush(compiled: CompiledLevel, boxCellId: number, dirIndex: number): Push {
  return {
    boxIndex: globalIndexFromCell(compiled, boxCellId),
    direction: DIRECTION_ORDER[dirIndex],
  };
}

function createSinglePushChild(
  compiled: CompiledLevel,
  state: SolverState,
  zobrist: ZobristTable,
  boxSlot: number,
  boxCellId: number,
  dirIndex: number,
  pushTo: number,
): SearchChild {
  const updatedBoxes = state.boxes.slice();
  updatedBoxes[boxSlot] = pushTo;

  return {
    state: createSolverState(compiled, boxCellId, updatedBoxes, zobrist),
    push: buildPush(compiled, boxCellId, dirIndex),
  };
}

function shouldContinueTunnel(
  compiled: CompiledLevel,
  boxCellId: number,
  dirIndex: number,
): boolean {
  if (compiled.goals.has(boxCellId)) {
    return false;
  }

  return hasTunnelDirection(compiled, boxCellId, dirIndex);
}

function createTunnelMacroChild(
  compiled: CompiledLevel,
  state: SolverState,
  zobrist: ZobristTable,
  boxSlot: number,
  initialBoxCellId: number,
  dirIndex: number,
): SearchChild | undefined {
  const updatedBoxes = state.boxes.slice();
  const occupancy = state.occupancy.clone();
  const pushes: Push[] = [];

  let currentBoxCellId = initialBoxCellId;
  let playerCellId = initialBoxCellId;

  while (true) {
    const pushTo = compiled.neighbors[currentBoxCellId * 4 + dirIndex];
    if (pushTo < 0 || occupancy.has(pushTo) || compiled.deadSquares.has(pushTo)) {
      break;
    }

    pushes.push(buildPush(compiled, currentBoxCellId, dirIndex));
    occupancy.set(currentBoxCellId, false);
    occupancy.set(pushTo, true);
    updatedBoxes[boxSlot] = pushTo;
    playerCellId = currentBoxCellId;
    currentBoxCellId = pushTo;

    if (!shouldContinueTunnel(compiled, currentBoxCellId, dirIndex)) {
      break;
    }
  }

  if (pushes.length === 0) {
    return undefined;
  }

  return {
    state: createSolverState(compiled, playerCellId, updatedBoxes, zobrist),
    push: pushes[0],
    pushes,
  };
}

export function pushKey(boxCellId: number, dirIndex: number): number {
  return boxCellId * 4 + dirIndex;
}

export function forEachPushChild(
  compiled: CompiledLevel,
  state: SolverState,
  zobrist: ZobristTable,
  visit: (child: SearchChild) => void,
): void {
  const reachability = computeReachability(compiled, state.player, state.occupancy);

  for (let boxIndex = 0; boxIndex < state.boxes.length; boxIndex += 1) {
    const boxCellId = state.boxes[boxIndex];

    for (let dirIndex = 0; dirIndex < DIRECTION_ORDER.length; dirIndex += 1) {
      const pushFrom = compiled.neighbors[boxCellId * 4 + OPPOSITE_DIR_INDEX[dirIndex]];
      if (pushFrom < 0 || !reachability.reachable.has(pushFrom)) {
        continue;
      }

      const pushTo = compiled.neighbors[boxCellId * 4 + dirIndex];
      if (pushTo < 0 || state.occupancy.has(pushTo) || compiled.deadSquares.has(pushTo)) {
        continue;
      }

      visit(createSinglePushChild(compiled, state, zobrist, boxIndex, boxCellId, dirIndex, pushTo));
    }
  }
}

export function forEachTunnelMacroChild(
  compiled: CompiledLevel,
  state: SolverState,
  zobrist: ZobristTable,
  visit: (child: SearchChild) => void,
): void {
  const reachability = computeReachability(compiled, state.player, state.occupancy);

  for (let boxIndex = 0; boxIndex < state.boxes.length; boxIndex += 1) {
    const boxCellId = state.boxes[boxIndex];

    for (let dirIndex = 0; dirIndex < DIRECTION_ORDER.length; dirIndex += 1) {
      const pushFrom = compiled.neighbors[boxCellId * 4 + OPPOSITE_DIR_INDEX[dirIndex]];
      if (pushFrom < 0 || !reachability.reachable.has(pushFrom)) {
        continue;
      }

      const child = createTunnelMacroChild(compiled, state, zobrist, boxIndex, boxCellId, dirIndex);
      if (child) {
        visit(child);
      }
    }
  }
}

export function forEachPiCorralChild(
  compiled: CompiledLevel,
  state: SolverState,
  zobrist: ZobristTable,
  visit: (child: SearchChild) => void,
): void {
  const reachability = computeReachability(compiled, state.player, state.occupancy);
  const restriction = detectPiCorralRestriction(compiled, state, reachability);

  for (let boxIndex = 0; boxIndex < state.boxes.length; boxIndex += 1) {
    const boxCellId = state.boxes[boxIndex];

    for (let dirIndex = 0; dirIndex < DIRECTION_ORDER.length; dirIndex += 1) {
      if (restriction && !restriction.allowedPushKeys.has(pushKey(boxCellId, dirIndex))) {
        continue;
      }

      const pushFrom = compiled.neighbors[boxCellId * 4 + OPPOSITE_DIR_INDEX[dirIndex]];
      if (pushFrom < 0 || !reachability.reachable.has(pushFrom)) {
        continue;
      }

      const pushTo = compiled.neighbors[boxCellId * 4 + dirIndex];
      if (pushTo < 0 || state.occupancy.has(pushTo) || compiled.deadSquares.has(pushTo)) {
        continue;
      }

      visit(createSinglePushChild(compiled, state, zobrist, boxIndex, boxCellId, dirIndex, pushTo));
    }
  }
}

export function stateKeyFingerprint(state: SolverState) {
  return fingerprintFromState(state);
}
