import { describe, expect, it } from 'vitest';

import { normalize } from '../normalize';

describe('normalize', () => {
  it('builds a deterministic key with sorted boxes', () => {
    const state = { playerIndex: 3, boxes: Uint32Array.from([9, 1, 5]) };

    expect(normalize(state)).toBe('p:3|b:1,5,9');
    expect(normalize({ playerIndex: 3, boxes: Uint32Array.from([1, 5, 9]) })).toBe('p:3|b:1,5,9');
  });

  it('distinguishes different player positions', () => {
    const left = normalize({ playerIndex: 1, boxes: Uint32Array.from([2, 3]) });
    const right = normalize({ playerIndex: 2, boxes: Uint32Array.from([2, 3]) });

    expect(left).not.toBe(right);
  });

  it('distinguishes different box sets', () => {
    const left = normalize({ playerIndex: 1, boxes: Uint32Array.from([2, 3]) });
    const right = normalize({ playerIndex: 1, boxes: Uint32Array.from([2, 4]) });

    expect(left).not.toBe(right);
  });
});
