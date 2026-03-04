import { describe, expect, it } from 'vitest';

import { moveBoxSorted } from '../boxes';

describe('moveBoxSorted', () => {
  it('moves a box to a higher index and re-sorts', () => {
    const result = moveBoxSorted(Uint32Array.from([2, 4]), 2, 6);
    expect(Array.from(result)).toEqual([4, 6]);
  });

  it('moves a box to a lower index and re-sorts', () => {
    const result = moveBoxSorted(Uint32Array.from([2, 4]), 4, 1);
    expect(Array.from(result)).toEqual([1, 2]);
  });

  it('handles a single-element array', () => {
    const result = moveBoxSorted(Uint32Array.from([5]), 5, 3);
    expect(Array.from(result)).toEqual([3]);
  });

  it('preserves sort order when destination is between existing boxes', () => {
    // [1, 5, 9]: move 1 to 7 => [5, 7, 9]
    const result = moveBoxSorted(Uint32Array.from([1, 5, 9]), 1, 7);
    expect(Array.from(result)).toEqual([5, 7, 9]);
  });

  it('throws when the box is not found', () => {
    const boxes = Uint32Array.from([2, 4]);
    expect(() => moveBoxSorted(boxes, 3, 5)).toThrow('Box not found');
  });
});
