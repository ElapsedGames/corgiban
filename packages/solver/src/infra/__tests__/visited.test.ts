import { describe, expect, it } from 'vitest';

import { VisitedSet } from '../visited';

describe('VisitedSet', () => {
  it('tracks visited fingerprints', () => {
    const visited = new VisitedSet();
    const key = { hi: 1, lo: 2 };
    const fingerprint = { player: 3, boxes: Uint16Array.from([4, 5]) };

    expect(visited.has(key, fingerprint)).toBe(false);
    visited.add(key, fingerprint);
    expect(visited.has(key, fingerprint)).toBe(true);
  });

  it('stores collisions separately when fingerprints differ', () => {
    const visited = new VisitedSet();
    const key = { hi: 9, lo: 9 };

    const first = { player: 1, boxes: Uint16Array.from([2]) };
    const second = { player: 1, boxes: Uint16Array.from([3]) };

    expect(visited.checkAndAdd(key, first)).toBe(false);
    expect(visited.checkAndAdd(key, second)).toBe(false);
    expect(visited.checkAndAdd(key, first)).toBe(true);
  });

  it('treats player or box-count mismatches as distinct fingerprints', () => {
    const visited = new VisitedSet();
    const key = { hi: 3, lo: 3 };

    visited.add(key, { player: 1, boxes: Uint16Array.from([2, 4]) });

    expect(visited.has(key, { player: 2, boxes: Uint16Array.from([2, 4]) })).toBe(false);
    expect(visited.has(key, { player: 1, boxes: Uint16Array.from([2]) })).toBe(false);
  });

  it('counts buckets rather than entries', () => {
    const visited = new VisitedSet();
    const keyA = { hi: 1, lo: 1 };
    const keyB = { hi: 2, lo: 2 };

    visited.add(keyA, { player: 1, boxes: Uint16Array.from([2]) });
    expect(visited.size).toBe(1);

    visited.add(keyA, { player: 2, boxes: Uint16Array.from([3]) });
    expect(visited.size).toBe(1);

    visited.add(keyB, { player: 1, boxes: Uint16Array.from([2]) });
    expect(visited.size).toBe(2);
  });
});
