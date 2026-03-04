import { describe, expect, it } from 'vitest';

import { colFromIndex, isInside, moveIndex, rowFromIndex, toIndex } from '../position';

describe('moveIndex', () => {
  it('returns a valid index when moving right', () => {
    // index 0 in a 2x2 grid is (row 0, col 0); moving right = (row 0, col 1) = index 1
    expect(moveIndex(0, 2, 2, 'R')).toBe(1);
  });

  it('returns a valid index when moving down', () => {
    // index 0 in a 2x2 grid is (row 0, col 0); moving down = (row 1, col 0) = index 2
    expect(moveIndex(0, 2, 2, 'D')).toBe(2);
  });

  it('returns null when moving off the top edge', () => {
    expect(moveIndex(0, 2, 2, 'U')).toBeNull();
  });

  it('returns null when moving off the left edge', () => {
    expect(moveIndex(0, 2, 2, 'L')).toBeNull();
  });

  it('returns null when moving off the right edge', () => {
    // index 1 in a 2x2 grid is (row 0, col 1); col 2 is outside
    expect(moveIndex(1, 2, 2, 'R')).toBeNull();
  });

  it('returns null when moving off the bottom edge', () => {
    // index 2 in a 2x2 grid is (row 1, col 0); row 2 is outside
    expect(moveIndex(2, 2, 2, 'D')).toBeNull();
  });
});

describe('toIndex', () => {
  it('converts row and column to a flat index', () => {
    expect(toIndex(0, 0, 5)).toBe(0);
    expect(toIndex(1, 2, 5)).toBe(7);
    expect(toIndex(3, 4, 5)).toBe(19);
  });
});

describe('rowFromIndex', () => {
  it('extracts the row from a flat index', () => {
    expect(rowFromIndex(0, 5)).toBe(0);
    expect(rowFromIndex(7, 5)).toBe(1);
    expect(rowFromIndex(19, 5)).toBe(3);
  });
});

describe('colFromIndex', () => {
  it('extracts the column from a flat index', () => {
    expect(colFromIndex(0, 5)).toBe(0);
    expect(colFromIndex(7, 5)).toBe(2);
    expect(colFromIndex(19, 5)).toBe(4);
  });
});

describe('isInside', () => {
  it('returns true for a cell within bounds', () => {
    expect(isInside(0, 0, 5, 5)).toBe(true);
    expect(isInside(4, 4, 5, 5)).toBe(true);
  });

  it('returns false for negative row or column', () => {
    expect(isInside(-1, 0, 5, 5)).toBe(false);
    expect(isInside(0, -1, 5, 5)).toBe(false);
  });

  it('returns false when row or column equals the grid dimension', () => {
    expect(isInside(5, 0, 5, 5)).toBe(false);
    expect(isInside(0, 5, 5, 5)).toBe(false);
  });
});
