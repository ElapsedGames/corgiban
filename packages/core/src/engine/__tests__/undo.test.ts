import { describe, expect, it } from 'vitest';

import { applyMove } from '../applyMove';
import { undo } from '../undo';
import { validateInvariants } from '../rules';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
import { createGame } from '../../model/gameState';
import type { LevelRuntime } from '../../model/level';

function expectStateEqual(
  left: ReturnType<typeof createGame>,
  right: ReturnType<typeof createGame>,
) {
  expect(left.playerIndex).toBe(right.playerIndex);
  expect(Array.from(left.boxes)).toEqual(Array.from(right.boxes));
  expect(left.history).toEqual(right.history);
  expect(left.stats).toEqual(right.stats);
}

function buildLevel(rows: string[]): LevelRuntime {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const staticGrid = new Uint8Array(width * height);
  let playerIndex = -1;
  const boxes: number[] = [];

  rows.forEach((row, rowIndex) => {
    if (row.length !== width) {
      throw new Error('Non-rectangular rows in test level.');
    }
    [...row].forEach((token, colIndex) => {
      const index = rowIndex * width + colIndex;
      switch (token) {
        case 'W':
          staticGrid[index] = STATIC_WALL;
          break;
        case 'T':
          staticGrid[index] = STATIC_TARGET;
          break;
        case 'E':
        case ' ':
          staticGrid[index] = STATIC_FLOOR;
          break;
        case 'P':
          staticGrid[index] = STATIC_FLOOR;
          playerIndex = index;
          break;
        case 'Q':
          staticGrid[index] = STATIC_TARGET;
          playerIndex = index;
          break;
        case 'B':
          staticGrid[index] = STATIC_FLOOR;
          boxes.push(index);
          break;
        case 'S':
          staticGrid[index] = STATIC_TARGET;
          boxes.push(index);
          break;
        default:
          throw new Error(`Unknown token "${token}" in test level.`);
      }
    });
  });

  if (playerIndex < 0) {
    throw new Error('Player missing from test level.');
  }

  boxes.sort((a, b) => a - b);

  return {
    levelId: 'test-level',
    width,
    height,
    staticGrid,
    initialPlayerIndex: playerIndex,
    initialBoxes: Uint32Array.from(boxes),
  };
}

describe('undo', () => {
  it('reverts a non-push move', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const initial = createGame(level);
    const moved = applyMove(initial, 'R').state;
    const undone = undo(moved);

    expect(undone.playerIndex).toBe(initial.playerIndex);
    expect(Array.from(undone.boxes)).toEqual(Array.from(initial.boxes));
    expect(undone.history).toHaveLength(0);
    expect(undone.stats.moves).toBe(0);
    expect(undone.stats.pushes).toBe(0);
    validateInvariants(undone);
  });

  it('reverts a push move', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const initial = createGame(level);
    const moved = applyMove(initial, 'R').state;
    const undone = undo(moved);

    expect(undone.playerIndex).toBe(initial.playerIndex);
    expect(Array.from(undone.boxes)).toEqual(Array.from(initial.boxes));
    expect(undone.history).toHaveLength(0);
    expect(undone.stats.moves).toBe(0);
    expect(undone.stats.pushes).toBe(0);
    validateInvariants(undone);
  });

  it('returns the same state when history is empty', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const initial = createGame(level);
    const undone = undo(initial);

    expect(undone).toBe(initial);
  });

  it('is deterministic for identical inputs', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const initial = createGame(level);
    const moved = applyMove(initial, 'R').state;

    const first = undo(moved);
    const second = undo(moved);

    expectStateEqual(first, second);
  });
});
