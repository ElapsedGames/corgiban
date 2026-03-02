import { describe, expect, it } from 'vitest';

import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL, isFloor, isTarget, isWall } from '../cell';

describe('cell helpers', () => {
  it('identifies walls', () => {
    expect(isWall(STATIC_WALL)).toBe(true);
    expect(isWall(STATIC_FLOOR)).toBe(false);
  });

  it('identifies targets', () => {
    expect(isTarget(STATIC_TARGET)).toBe(true);
    expect(isTarget(STATIC_FLOOR)).toBe(false);
  });

  it('treats targets as walkable floors', () => {
    expect(isFloor(STATIC_FLOOR)).toBe(true);
    // Targets are walkable; only walls block movement.
    expect(isFloor(STATIC_TARGET)).toBe(true);
    expect(isFloor(STATIC_WALL)).toBe(false);
  });
});
