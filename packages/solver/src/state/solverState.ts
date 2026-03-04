import type { LevelRuntime } from '@corgiban/core';

import type { StateFingerprint } from '../infra/visited';
import { Bitset } from '../infra/bitset';
import { computeReachability } from '../infra/reachability';
import type { ZobristKey, ZobristTable } from '../infra/zobrist';
import { hashState } from '../infra/zobrist';
import type { CompiledLevel } from './compiledLevel';
import { cellIdFromGlobal } from './compiledLevel';

export type SolverState = {
  boxes: Uint16Array;
  player: number;
  occupancy: Bitset;
  hash: ZobristKey;
};

export function buildOccupancy(cellCount: number, boxes: Uint16Array): Bitset {
  const occupancy = new Bitset(cellCount);
  for (let index = 0; index < boxes.length; index += 1) {
    occupancy.set(boxes[index], true);
  }
  return occupancy;
}

export function createSolverState(
  compiled: CompiledLevel,
  playerCellId: number,
  boxes: Uint16Array,
  zobrist: ZobristTable,
): SolverState {
  const sortedBoxes = Uint16Array.from(boxes);
  sortedBoxes.sort();

  const occupancy = buildOccupancy(compiled.cellCount, sortedBoxes);
  const reachability = computeReachability(compiled, playerCellId, occupancy);
  const canonicalPlayer = reachability.minCellId;
  const hash = hashState(zobrist, canonicalPlayer, sortedBoxes);

  return {
    boxes: sortedBoxes,
    player: canonicalPlayer,
    occupancy,
    hash,
  };
}

export function createInitialSolverState(
  level: LevelRuntime,
  compiled: CompiledLevel,
  zobrist: ZobristTable,
): SolverState {
  const playerCellId = cellIdFromGlobal(compiled, level.initialPlayerIndex);
  if (playerCellId < 0) {
    throw new Error('Initial player position is not on a walkable cell.');
  }

  const boxCellIds = Array.from(level.initialBoxes, (boxIndex) => {
    const cellId = cellIdFromGlobal(compiled, boxIndex);
    if (cellId < 0) {
      throw new Error(`Box at ${boxIndex} is not on a walkable cell.`);
    }
    return cellId;
  });

  return createSolverState(compiled, playerCellId, Uint16Array.from(boxCellIds), zobrist);
}

export function fingerprintFromState(state: SolverState): StateFingerprint {
  return { player: state.player, boxes: state.boxes };
}
