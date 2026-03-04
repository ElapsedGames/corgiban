import { describe, expect, it } from 'vitest';

import { applyMove } from '../applyMove';
import { restart } from '../restart';
import { validateInvariants } from '../rules';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
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

describe('restart', () => {
  it('resets state to initial positions and clears history', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const initial = createGame(level);
    const moved = applyMove(initial, 'R').state;
    const restarted = restart(moved);

    expect(restarted.playerIndex).toBe(initial.playerIndex);
    expect(Array.from(restarted.boxes)).toEqual(Array.from(initial.boxes));
    expect(restarted.history).toHaveLength(0);
    expect(restarted.stats.moves).toBe(0);
    expect(restarted.stats.pushes).toBe(0);
    validateInvariants(restarted);
  });

  it('is a no-op when already at the initial state', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const initial = createGame(level);
    const restarted = restart(initial);

    expect(restarted.playerIndex).toBe(initial.playerIndex);
    expect(Array.from(restarted.boxes)).toEqual(Array.from(initial.boxes));
    expect(restarted.history).toHaveLength(0);
    expect(restarted.stats.moves).toBe(0);
    validateInvariants(restarted);
  });

  it('resets after multiple moves', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WWWWW']);
    const initial = createGame(level);
    const after1 = applyMove(initial, 'R').state;
    const after2 = applyMove(after1, 'L').state;
    const restarted = restart(after2);

    expect(restarted.playerIndex).toBe(initial.playerIndex);
    expect(Array.from(restarted.boxes)).toEqual(Array.from(initial.boxes));
    expect(restarted.history).toHaveLength(0);
    expect(restarted.stats.moves).toBe(0);
    validateInvariants(restarted);
  });
});
