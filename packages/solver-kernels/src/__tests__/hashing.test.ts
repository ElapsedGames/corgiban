import { describe, expect, it } from 'vitest';

import { hashState64, hashStatePair } from '../hashing';

describe('hashing kernels', () => {
  it('produces deterministic 64-bit hashes', () => {
    const first = hashState64({ playerIndex: 4, boxIndices: [2, 8, 10] });
    const second = hashState64({ playerIndex: 4, boxIndices: [2, 8, 10] });
    const different = hashState64({ playerIndex: 4, boxIndices: [2, 8, 11] });

    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it('splits hash into hi/lo pairs', () => {
    const pair = hashStatePair({ playerIndex: 1, boxIndices: [1, 2] });
    expect(Number.isInteger(pair.hi)).toBe(true);
    expect(Number.isInteger(pair.lo)).toBe(true);
  });
});
