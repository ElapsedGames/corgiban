import { describe, expect, it } from 'vitest';

import type { Direction } from '@corgiban/shared';

import { applyMove } from '../applyMove';
import { applyMoves } from '../applyMoves';
import { createGame } from '../../model/gameState';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
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

function runMoves(level: LevelRuntime, moves: Direction[]) {
  let state = createGame(level);
  for (const move of moves) {
    state = applyMove(state, move).state;
  }
  return state;
}

describe('applyMoves', () => {
  it('applies multiple moves and reports changes', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMoves(state, ['R', 'R']);
    const expected = runMoves(level, ['R', 'R']);

    expect(result.changed).toBe(true);
    expect(result.state.playerIndex).toBe(expected.playerIndex);
    expect(Array.from(result.state.boxes)).toEqual(Array.from(expected.boxes));
    expect(result.state.stats).toEqual(expected.stats);
  });

  it('stops early when stopOnNoChange is enabled', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMoves(state, ['L', 'R'], { stopOnNoChange: true });

    expect(result.changed).toBe(false);
    expect(result.stoppedAt).toBe(0);
    expect(result.state).toBe(state);
  });

  it('continues past blocked moves by default', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMoves(state, ['L', 'R']);

    expect(result.changed).toBe(true);
    expect(result.stoppedAt).toBeUndefined();
    expect(result.state.playerIndex).toBe(state.playerIndex + 1);
  });

  it('returns changed false when no moves apply', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMoves(state, ['L', 'U']);

    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });
});
