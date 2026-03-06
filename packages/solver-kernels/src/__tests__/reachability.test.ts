import { describe, expect, it } from 'vitest';

import { reachabilityFloodFill } from '../reachability';

describe('reachabilityFloodFill', () => {
  it('returns reachable cells around walls and blocked cells', () => {
    const width = 4;
    const height = 3;
    const wallMask = Uint8Array.from([1, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1]);

    const blockedMask = Uint8Array.from([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);

    const result = reachabilityFloodFill({ width, height, startIndex: 5, wallMask, blockedMask });
    expect(result.reachableCount).toBe(1);
    expect(result.reachableMask[5]).toBe(1);
    expect(result.reachableMask[6]).toBe(0);
  });

  it('throws when width is negative', () => {
    expect(() =>
      reachabilityFloodFill({
        width: -1,
        height: 2,
        startIndex: 0,
        wallMask: new Uint8Array(0),
      }),
    ).toThrow('width and height must be non-negative integers.');
  });

  it('throws when height is not an integer', () => {
    expect(() =>
      reachabilityFloodFill({
        width: 2,
        height: 1.5,
        startIndex: 0,
        wallMask: new Uint8Array(0),
      }),
    ).toThrow('width and height must be non-negative integers.');
  });

  it('returns an empty mask for zero-sized grids', () => {
    const result = reachabilityFloodFill({
      width: 0,
      height: 0,
      startIndex: 0,
      wallMask: new Uint8Array(0),
    });

    expect(result.reachableCount).toBe(0);
    expect([...result.reachableMask]).toEqual([]);
  });

  it('returns empty reachability when start is invalid', () => {
    const result = reachabilityFloodFill({
      width: 2,
      height: 2,
      startIndex: 99,
      wallMask: Uint8Array.from([0, 0, 0, 0]),
    });

    expect(result.reachableCount).toBe(0);
    expect([...result.reachableMask]).toEqual([0, 0, 0, 0]);
  });

  it('returns empty reachability when the start cell is blocked', () => {
    const result = reachabilityFloodFill({
      width: 2,
      height: 2,
      startIndex: 1,
      wallMask: Uint8Array.from([0, 1, 0, 0]),
    });

    expect(result.reachableCount).toBe(0);
    expect([...result.reachableMask]).toEqual([0, 0, 0, 0]);
  });

  it('fills all connected open cells from the starting position', () => {
    const result = reachabilityFloodFill({
      width: 3,
      height: 3,
      startIndex: 4,
      wallMask: new Uint8Array(9),
    });

    expect(result.reachableCount).toBe(9);
    expect([...result.reachableMask]).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('throws when the wall mask size does not match width * height', () => {
    expect(() =>
      reachabilityFloodFill({
        width: 2,
        height: 2,
        startIndex: 0,
        wallMask: Uint8Array.from([0, 0, 0]),
      }),
    ).toThrow('wallMask length must equal width * height (4).');
  });

  it('throws when the blocked mask size does not match width * height', () => {
    expect(() =>
      reachabilityFloodFill({
        width: 2,
        height: 2,
        startIndex: 0,
        wallMask: Uint8Array.from([0, 0, 0, 0]),
        blockedMask: Uint8Array.from([0, 0, 0]),
      }),
    ).toThrow('blockedMask length must equal width * height (4).');
  });
});
