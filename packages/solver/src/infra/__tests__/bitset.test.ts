import { describe, expect, it } from 'vitest';

import { Bitset, bitsetFromIndices } from '../bitset';

describe('Bitset', () => {
  it('sets and reads bits', () => {
    const bitset = new Bitset(10);

    bitset.set(3, true);
    bitset.set(5, true);

    expect(bitset.has(3)).toBe(true);
    expect(bitset.has(5)).toBe(true);
    expect(bitset.has(4)).toBe(false);
  });

  it('clears bits', () => {
    const bitset = new Bitset(6);
    bitset.set(2, true);
    bitset.set(4, true);

    bitset.set(2, false);

    expect(bitset.has(2)).toBe(false);
    expect(bitset.has(4)).toBe(true);
  });

  it('clones and clears', () => {
    const bitset = bitsetFromIndices(5, [0, 2, 4]);
    const clone = bitset.clone();
    clone.clear();

    expect(bitset.toArray()).toEqual([0, 2, 4]);
    expect(clone.toArray()).toEqual([]);
  });

  it('fills with all bits', () => {
    const bitset = new Bitset(4);
    bitset.fill(true);

    expect(bitset.toArray()).toEqual([0, 1, 2, 3]);
  });

  it('throws on out-of-bounds access', () => {
    const bitset = new Bitset(2);

    expect(() => bitset.has(-1)).toThrow('out of bounds');
    expect(() => bitset.has(2)).toThrow('out of bounds');
    expect(() => bitset.set(-1, true)).toThrow('out of bounds');
    expect(() => bitset.set(2, true)).toThrow('out of bounds');
  });
});
