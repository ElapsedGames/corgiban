import type { LevelRuntime } from '@corgiban/core';
import { isTarget, isWall } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { Bitset } from '../infra/bitset';

export const DIRECTION_ORDER: Direction[] = ['U', 'D', 'L', 'R'];

const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  U: { dx: 0, dy: -1 },
  D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 },
  R: { dx: 1, dy: 0 },
};

export type CompiledLevel = {
  width: number;
  height: number;
  cellCount: number;
  globalToCell: Int32Array;
  cellToGlobal: Uint32Array;
  neighbors: Int32Array;
  goals: Bitset;
  goalCells: Uint16Array;
  deadSquares: Bitset;
  goalDistances: Uint16Array[];
};

function buildCompaction(level: LevelRuntime): {
  cellCount: number;
  globalToCell: Int32Array;
  cellToGlobal: Uint32Array;
  goalCellIds: number[];
} {
  const { width, height, staticGrid } = level;
  const size = width * height;
  const globalToCell = new Int32Array(size);
  globalToCell.fill(-1);
  const cellToGlobal: number[] = [];
  const goalCellIds: number[] = [];

  for (let index = 0; index < size; index += 1) {
    if (isWall(staticGrid[index])) {
      continue;
    }
    const cellId = cellToGlobal.length;
    globalToCell[index] = cellId;
    cellToGlobal.push(index);
    if (isTarget(staticGrid[index])) {
      goalCellIds.push(cellId);
    }
  }

  return {
    cellCount: cellToGlobal.length,
    globalToCell,
    cellToGlobal: Uint32Array.from(cellToGlobal),
    goalCellIds,
  };
}

function buildNeighbors(
  level: LevelRuntime,
  cellToGlobal: Uint32Array,
  globalToCell: Int32Array,
): Int32Array {
  const { width, height } = level;
  const neighbors = new Int32Array(cellToGlobal.length * 4);
  neighbors.fill(-1);

  for (let cellId = 0; cellId < cellToGlobal.length; cellId += 1) {
    const globalIndex = cellToGlobal[cellId];
    const row = Math.floor(globalIndex / width);
    const col = globalIndex % width;

    for (let dirIndex = 0; dirIndex < DIRECTION_ORDER.length; dirIndex += 1) {
      const direction = DIRECTION_ORDER[dirIndex];
      const delta = DIRECTION_DELTAS[direction];
      const nextRow = row + delta.dy;
      const nextCol = col + delta.dx;
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) {
        continue;
      }
      const nextGlobal = nextRow * width + nextCol;
      const nextCell = globalToCell[nextGlobal];
      if (nextCell >= 0) {
        neighbors[cellId * 4 + dirIndex] = nextCell;
      }
    }
  }

  return neighbors;
}

function isWallAt(level: LevelRuntime, row: number, col: number): boolean {
  const { width, height, staticGrid } = level;
  if (row < 0 || row >= height || col < 0 || col >= width) {
    return true;
  }
  const index = row * width + col;
  return isWall(staticGrid[index]);
}

function buildDeadSquares(level: LevelRuntime, cellToGlobal: Uint32Array): Bitset {
  const { width } = level;
  const deadSquares = new Bitset(cellToGlobal.length);

  for (let cellId = 0; cellId < cellToGlobal.length; cellId += 1) {
    const globalIndex = cellToGlobal[cellId];
    const row = Math.floor(globalIndex / width);
    const col = globalIndex % width;
    const isGoal = isTarget(level.staticGrid[globalIndex]);
    if (isGoal) {
      continue;
    }

    const wallUp = isWallAt(level, row - 1, col);
    const wallDown = isWallAt(level, row + 1, col);
    const wallLeft = isWallAt(level, row, col - 1);
    const wallRight = isWallAt(level, row, col + 1);

    const isCorner =
      (wallUp && wallLeft) ||
      (wallUp && wallRight) ||
      (wallDown && wallLeft) ||
      (wallDown && wallRight);

    if (isCorner) {
      deadSquares.set(cellId, true);
    }
  }

  return deadSquares;
}

function buildGoalDistances(
  cellCount: number,
  neighbors: Int32Array,
  goalCells: number[],
): Uint16Array[] {
  const distances: Uint16Array[] = [];

  for (const goalCellId of goalCells) {
    const distance = new Uint16Array(cellCount);
    distance.fill(0xffff);

    const queue = new Uint16Array(cellCount);
    let head = 0;
    let tail = 0;
    distance[goalCellId] = 0;
    queue[tail] = goalCellId;
    tail += 1;

    while (head < tail) {
      const cellId = queue[head];
      head += 1;
      const nextDistance = distance[cellId] + 1;

      for (let dirIndex = 0; dirIndex < 4; dirIndex += 1) {
        const next = neighbors[cellId * 4 + dirIndex];
        if (next < 0) {
          continue;
        }
        if (distance[next] !== 0xffff) {
          continue;
        }
        distance[next] = nextDistance;
        queue[tail] = next;
        tail += 1;
      }
    }

    distances.push(distance);
  }

  return distances;
}

export function compileLevel(level: LevelRuntime): CompiledLevel {
  const { cellCount, globalToCell, cellToGlobal, goalCellIds } = buildCompaction(level);
  const neighbors = buildNeighbors(level, cellToGlobal, globalToCell);
  const goals = new Bitset(cellCount);
  for (const goal of goalCellIds) {
    goals.set(goal, true);
  }
  const deadSquares = buildDeadSquares(level, cellToGlobal);
  const goalDistances = buildGoalDistances(cellCount, neighbors, goalCellIds);

  return {
    width: level.width,
    height: level.height,
    cellCount,
    globalToCell,
    cellToGlobal,
    neighbors,
    goals,
    goalCells: Uint16Array.from(goalCellIds),
    deadSquares,
    goalDistances,
  };
}

export function cellIdFromGlobal(level: CompiledLevel, index: number): number {
  return level.globalToCell[index];
}

export function globalIndexFromCell(level: CompiledLevel, cellId: number): number {
  return level.cellToGlobal[cellId];
}
