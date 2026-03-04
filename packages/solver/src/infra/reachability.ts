import type { CompiledLevel } from '../state/compiledLevel';
import { Bitset } from './bitset';

export type ReachabilityResult = {
  reachable: Bitset;
  minCellId: number;
  count: number;
};

export function computeReachability(
  level: CompiledLevel,
  startCellId: number,
  occupied: Bitset,
): ReachabilityResult {
  if (startCellId < 0 || startCellId >= level.cellCount) {
    throw new Error(`startCellId ${startCellId} is out of bounds.`);
  }
  if (occupied.has(startCellId)) {
    throw new Error('Player start cell is occupied by a box.');
  }

  const reachable = new Bitset(level.cellCount);
  const queue = new Uint16Array(level.cellCount);
  let head = 0;
  let tail = 0;
  let minCellId = startCellId;
  let count = 0;

  reachable.set(startCellId, true);
  queue[tail] = startCellId;
  tail += 1;
  count += 1;

  while (head < tail) {
    const cellId = queue[head];
    head += 1;

    for (let dirIndex = 0; dirIndex < 4; dirIndex += 1) {
      const next = level.neighbors[cellId * 4 + dirIndex];
      if (next < 0) {
        continue;
      }
      if (reachable.has(next)) {
        continue;
      }
      if (occupied.has(next)) {
        continue;
      }
      reachable.set(next, true);
      queue[tail] = next;
      tail += 1;
      count += 1;
      if (next < minCellId) {
        minCellId = next;
      }
    }
  }

  return { reachable, minCellId, count };
}
