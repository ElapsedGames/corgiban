import { describe, expect, it } from 'vitest';

import type { Direction } from '@corgiban/shared';

import { applyMove } from '../applyMove';
import { validateInvariants } from '../rules';
import { isTarget, STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
import { createGame } from '../../model/gameState';
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

describe('applyMove', () => {
  it('moves the player onto empty floor', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'R');

    expect(result.changed).toBe(true);
    expect(result.pushed).toBe(false);
    expect(result.state.playerIndex).toBe(state.playerIndex + 1);
    expect(Array.from(result.state.boxes)).toEqual(Array.from(state.boxes));
    expect(result.state.stats.moves).toBe(1);
    expect(result.state.stats.pushes).toBe(0);
    expect(result.state.history).toHaveLength(1);
    validateInvariants(result.state);
  });

  it('does not move into a wall', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'U');

    expect(result.changed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('does not move off the grid', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'L');

    expect(result.changed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('pushes a box when space is available', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'R');

    expect(result.changed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.state.playerIndex).toBe(state.playerIndex + 1);
    expect(Array.from(result.state.boxes)).toEqual([state.playerIndex + 2]);
    expect(result.state.stats.moves).toBe(1);
    expect(result.state.stats.pushes).toBe(1);
    validateInvariants(result.state);
  });

  it('does not push a box into a wall', () => {
    const level = buildLevel(['WWWWW', 'WPBWW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'R');

    expect(result.changed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('does not push a box off the grid', () => {
    const level = buildLevel(['WWWW', 'WPBW', 'WWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'R');

    expect(result.changed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('does not push a box into another box', () => {
    const level = buildLevel(['WWWWW', 'WPBBW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'R');

    expect(result.changed).toBe(false);
    expect(result.pushed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('treats boxes on targets as normal boxes for movement', () => {
    const level = buildLevel(['WWWWW', 'WPSEW', 'WWWWW']);
    const state = createGame(level);
    const result = applyMove(state, 'R');

    expect(result.changed).toBe(true);
    expect(result.pushed).toBe(true);
    expect(result.state.playerIndex).toBe(state.playerIndex + 1);
    expect(Array.from(result.state.boxes)).toEqual([state.playerIndex + 2]);
    expect(isTarget(level.staticGrid[result.state.boxes[0]])).toBe(false);
    validateInvariants(result.state);
  });

  it('is deterministic across identical move sequences', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WTEEW', 'WWWWW']);
    const moves: Direction[] = ['R', 'R', 'L', 'D', 'L', 'U', 'U', 'R'];

    const first = runMoves(level, moves);
    const second = runMoves(level, moves);

    expect(first.playerIndex).toBe(second.playerIndex);
    expect(Array.from(first.boxes)).toEqual(Array.from(second.boxes));
    expect(first.stats).toEqual(second.stats);
    expect(first.history).toEqual(second.history);
  });
});
