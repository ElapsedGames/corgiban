import type { LevelRuntime } from '@corgiban/core';
import { isWall } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import type { Push } from '../api/solverTypes';

const DIRECTION_ORDER: Direction[] = ['U', 'D', 'L', 'R'];

const DIRECTION_DELTAS: Record<Direction, { row: number; col: number }> = {
  U: { row: -1, col: 0 },
  D: { row: 1, col: 0 },
  L: { row: 0, col: -1 },
  R: { row: 0, col: 1 },
};

const OPPOSITE_DIRECTION: Record<Direction, Direction> = {
  U: 'D',
  D: 'U',
  L: 'R',
  R: 'L',
};

function moveIndex(
  index: number,
  width: number,
  height: number,
  direction: Direction,
): number | null {
  const row = Math.floor(index / width);
  const col = index % width;
  const delta = DIRECTION_DELTAS[direction];
  const nextRow = row + delta.row;
  const nextCol = col + delta.col;
  if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) {
    return null;
  }
  return nextRow * width + nextCol;
}

function findPath(
  level: LevelRuntime,
  startIndex: number,
  targetIndex: number,
  blocked: Uint8Array,
): Direction[] | null {
  if (startIndex === targetIndex) {
    return [];
  }

  const { width, height, staticGrid } = level;
  const size = width * height;
  const visited = new Uint8Array(size);
  const prev = new Int32Array(size);
  const prevDir = new Int8Array(size);
  const queue = new Int32Array(size);

  prev.fill(-1);
  prevDir.fill(-1);

  let head = 0;
  let tail = 0;
  queue[tail] = startIndex;
  tail += 1;
  visited[startIndex] = 1;

  while (head < tail) {
    const current = queue[head];
    head += 1;

    for (let dirIndex = 0; dirIndex < DIRECTION_ORDER.length; dirIndex += 1) {
      const direction = DIRECTION_ORDER[dirIndex];
      const nextIndex = moveIndex(current, width, height, direction);
      if (nextIndex === null) {
        continue;
      }
      if (visited[nextIndex]) {
        continue;
      }
      if (blocked[nextIndex]) {
        continue;
      }
      if (isWall(staticGrid[nextIndex])) {
        continue;
      }

      visited[nextIndex] = 1;
      prev[nextIndex] = current;
      prevDir[nextIndex] = dirIndex;

      if (nextIndex === targetIndex) {
        const path: Direction[] = [];
        let cursor = nextIndex;
        while (cursor !== startIndex) {
          const directionIndex = prevDir[cursor];
          path.push(DIRECTION_ORDER[directionIndex]);
          cursor = prev[cursor];
        }
        path.reverse();
        return path;
      }

      queue[tail] = nextIndex;
      tail += 1;
    }
  }

  return null;
}

function buildBlockedMap(size: number, boxes: number[]): Uint8Array {
  const blocked = new Uint8Array(size);
  for (const boxIndex of boxes) {
    blocked[boxIndex] = 1;
  }
  return blocked;
}

export type ExpansionStart = {
  playerIndex: number;
  boxes: Uint32Array | number[];
};

export function expandSolutionFromStart(level: LevelRuntime, pushes: Push[]): Direction[] {
  return expandSolution(level, pushes, {
    playerIndex: level.initialPlayerIndex,
    boxes: level.initialBoxes,
  });
}

export function expandSolution(
  level: LevelRuntime,
  pushes: Push[],
  start: ExpansionStart,
): Direction[] {
  const { width, height } = level;
  const size = width * height;
  const boxes = Array.from(start.boxes);
  let playerIndex = start.playerIndex;
  const moves: Direction[] = [];

  const blocked = buildBlockedMap(size, boxes);

  for (const push of pushes) {
    const { boxIndex, direction } = push;
    if (!blocked[boxIndex]) {
      throw new Error(`Push references missing box at index ${boxIndex}.`);
    }

    const pushFromIndex = moveIndex(boxIndex, width, height, OPPOSITE_DIRECTION[direction]);
    if (pushFromIndex === null) {
      throw new Error(`Push entry cell is out of bounds for box ${boxIndex}.`);
    }

    const path = findPath(level, playerIndex, pushFromIndex, blocked);
    if (!path) {
      throw new Error(`No walk path found to push entry cell ${pushFromIndex}.`);
    }

    const nextBoxIndex = moveIndex(boxIndex, width, height, direction);
    if (nextBoxIndex === null) {
      throw new Error(`Push moves box ${boxIndex} out of bounds.`);
    }

    if (blocked[nextBoxIndex]) {
      throw new Error(`Push moves box ${boxIndex} into an occupied cell.`);
    }

    if (isWall(level.staticGrid[nextBoxIndex])) {
      throw new Error(`Push moves box ${boxIndex} into a wall.`);
    }

    moves.push(...path, direction);

    const boxSlot = boxes.indexOf(boxIndex);
    boxes[boxSlot] = nextBoxIndex;
    playerIndex = boxIndex;

    blocked[boxIndex] = 0;
    blocked[nextBoxIndex] = 1;
  }

  return moves;
}

export function directionsToString(directions: Direction[]): string {
  return directions.join('');
}
