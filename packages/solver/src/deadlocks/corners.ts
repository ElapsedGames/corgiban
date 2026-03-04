import type { CompiledLevel } from '../state/compiledLevel';

export function isCornerDeadlock(level: CompiledLevel, cellId: number): boolean {
  if (cellId < 0 || cellId >= level.cellCount) {
    throw new Error(`cellId ${cellId} is out of bounds.`);
  }
  if (level.goals.has(cellId)) {
    return false;
  }

  const upBlocked = level.neighbors[cellId * 4] < 0;
  const downBlocked = level.neighbors[cellId * 4 + 1] < 0;
  const leftBlocked = level.neighbors[cellId * 4 + 2] < 0;
  const rightBlocked = level.neighbors[cellId * 4 + 3] < 0;

  return (
    (upBlocked && leftBlocked) ||
    (upBlocked && rightBlocked) ||
    (downBlocked && leftBlocked) ||
    (downBlocked && rightBlocked)
  );
}
