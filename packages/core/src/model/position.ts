import type { Direction } from '@corgiban/shared';

import { directionVectors } from './direction';

export function toIndex(row: number, col: number, width: number): number {
  return row * width + col;
}

export function rowFromIndex(index: number, width: number): number {
  return Math.floor(index / width);
}

export function colFromIndex(index: number, width: number): number {
  return index % width;
}

export function isInside(row: number, col: number, width: number, height: number): boolean {
  return row >= 0 && row < height && col >= 0 && col < width;
}

export function moveIndex(
  index: number,
  width: number,
  height: number,
  direction: Direction,
): number | null {
  const row = rowFromIndex(index, width);
  const col = colFromIndex(index, width);
  const vector = directionVectors[direction];
  const nextRow = row + vector.dy;
  const nextCol = col + vector.dx;

  if (!isInside(nextRow, nextCol, width, height)) {
    return null;
  }

  return toIndex(nextRow, nextCol, width);
}
