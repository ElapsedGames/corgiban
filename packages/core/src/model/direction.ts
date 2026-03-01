import type { Direction } from '@corgiban/shared';

export const directionVectors: Record<Direction, { dx: number; dy: number }> = {
  U: { dx: 0, dy: -1 },
  D: { dx: 0, dy: 1 },
  L: { dx: -1, dy: 0 },
  R: { dx: 1, dy: 0 },
};

export const directionOrder: Direction[] = ['U', 'D', 'L', 'R'];
