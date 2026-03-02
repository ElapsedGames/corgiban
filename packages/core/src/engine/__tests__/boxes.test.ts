import { describe, expect, it } from 'vitest';

import { moveBoxSorted } from '../boxes';

describe('moveBoxSorted', () => {
  it('throws when the box is not found', () => {
    const boxes = Uint32Array.from([2, 4]);

    expect(() => moveBoxSorted(boxes, 3, 5)).toThrow('Box not found');
  });
});
