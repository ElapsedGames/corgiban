import { describe, expect, it } from 'vitest';

import { createGame } from '../../model/gameState';
import type { LevelRuntime } from '../../model/level';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
import { selectCellAt } from '../selectCellAt';

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

describe('selectCellAt', () => {
  it('reads wall and target cells from a level runtime', () => {
    const level = buildLevel(['WWWWW', 'WQSEW', 'WWWWW']);

    const wallCell = selectCellAt(level, 0);
    expect(wallCell).toEqual({ wall: true, target: false, box: false, player: false });

    const targetCell = selectCellAt(level, level.initialPlayerIndex);
    expect(targetCell.wall).toBe(false);
    expect(targetCell.target).toBe(true);
    expect(targetCell.box).toBe(false);
    expect(targetCell.player).toBe(false);
  });

  it('detects player and boxes from a game state', () => {
    const level = buildLevel(['WWWWW', 'WQSEW', 'WWWWW']);
    const state = createGame(level);

    const playerCell = selectCellAt(state, level.initialPlayerIndex);
    expect(playerCell.player).toBe(true);
    expect(playerCell.target).toBe(true);

    const boxCell = selectCellAt(state, level.initialBoxes[0]);
    expect(boxCell.box).toBe(true);
    expect(boxCell.target).toBe(true);

    const emptyCell = selectCellAt(state, level.initialPlayerIndex + 2);
    expect(emptyCell).toEqual({ wall: false, target: false, box: false, player: false });
  });
});
