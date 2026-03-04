import { describe, expect, it } from 'vitest';

import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../cell';
import { createGame } from '../gameState';
import type { LevelRuntime } from '../level';

const testLevel: LevelRuntime = {
  levelId: 'test-level',
  width: 2,
  height: 2,
  staticGrid: Uint8Array.from([STATIC_WALL, STATIC_FLOOR, STATIC_TARGET, STATIC_FLOOR]),
  initialPlayerIndex: 1,
  initialBoxes: Uint32Array.from([2]),
};

describe('createGame', () => {
  it('places the player at the initial position', () => {
    const state = createGame(testLevel);
    expect(state.playerIndex).toBe(testLevel.initialPlayerIndex);
  });

  it('copies the initial boxes (not the same reference)', () => {
    const state = createGame(testLevel);
    expect(Array.from(state.boxes)).toEqual(Array.from(testLevel.initialBoxes));
    expect(state.boxes).not.toBe(testLevel.initialBoxes);
  });

  it('starts with an empty history', () => {
    const state = createGame(testLevel);
    expect(state.history).toHaveLength(0);
  });

  it('starts with zeroed stats', () => {
    const state = createGame(testLevel);
    expect(state.stats.moves).toBe(0);
    expect(state.stats.pushes).toBe(0);
  });

  it('holds a reference to the level', () => {
    const state = createGame(testLevel);
    expect(state.level).toBe(testLevel);
  });
});
