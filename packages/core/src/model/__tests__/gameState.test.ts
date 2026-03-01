import { describe, expect, it } from 'vitest';

import { createGame } from '../gameState';
import type { GameState } from '../gameState';
import type { LevelRuntime } from '../level';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../cell';

function expectStateEqual(left: GameState, right: GameState): void {
  expect(left.level).toBe(right.level);
  expect(left.playerIndex).toBe(right.playerIndex);
  expect(Array.from(left.boxes)).toEqual(Array.from(right.boxes));
  expect(left.history).toEqual(right.history);
  expect(left.stats).toEqual(right.stats);
}

describe('createGame', () => {
  it('is deterministic for the same level input', () => {
    const level: LevelRuntime = {
      levelId: 'test-level',
      width: 2,
      height: 2,
      staticGrid: Uint8Array.from([STATIC_WALL, STATIC_FLOOR, STATIC_TARGET, STATIC_FLOOR]),
      initialPlayerIndex: 1,
      initialBoxes: Uint32Array.from([2]),
    };

    const first = createGame(level);
    const second = createGame(level);

    expectStateEqual(first, second);
  });
});
