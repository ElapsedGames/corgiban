import { describe, expect, it } from 'vitest';

import { isWin, validateInvariants } from '../rules';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
import { createGame } from '../../model/gameState';
import type { GameState } from '../../model/gameState';
import type { LevelRuntime } from '../../model/level';

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

describe('isWin', () => {
  it('returns false when any box is off target', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWTWW']);
    const state = createGame(level);

    expect(isWin(state)).toBe(false);
  });

  it('returns true when all boxes are on targets', () => {
    const level = buildLevel(['WWWWW', 'WPSEW', 'WWTWW']);
    const state = createGame(level);

    expect(isWin(state)).toBe(true);
  });

  it('returns true when there are no boxes', () => {
    const level = buildLevel(['WWWWW', 'WPEWW', 'WWWWW']);
    const state = createGame(level);

    expect(isWin(state)).toBe(true);
  });
});

describe('validateInvariants', () => {
  it('throws when the player is on a wall', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state: GameState = {
      ...createGame(level),
      playerIndex: 0,
    };

    expect(() => validateInvariants(state)).toThrow('Player is on a wall');
  });

  it('throws when the player overlaps a box', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const base = createGame(level);
    const state: GameState = {
      ...base,
      playerIndex: base.boxes[0],
    };

    expect(() => validateInvariants(state)).toThrow('Player overlaps a box');
  });

  it('throws when boxes overlap', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const base = createGame(level);
    const state: GameState = {
      ...base,
      boxes: new Uint32Array([base.boxes[0], base.boxes[0]]),
    };

    expect(() => validateInvariants(state)).toThrow('Boxes overlap');
  });

  it('throws when a box is on a wall', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const base = createGame(level);
    const state: GameState = {
      ...base,
      boxes: new Uint32Array([0]),
    };

    expect(() => validateInvariants(state)).toThrow('Box is on a wall');
  });
});
