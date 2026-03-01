import { describe, expect, it } from 'vitest';

import { hash } from '../hash';
import { normalize } from '../normalize';

describe('hash', () => {
  it('returns a deterministic unsigned 32-bit number', () => {
    const key = 'p:1|b:2,3';
    const first = hash(key);
    const second = hash(key);

    expect(first).toBe(second);
    expect(Number.isInteger(first)).toBe(true);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(2 ** 32);
  });

  it('changes when the key changes', () => {
    expect(hash('p:1|b:2,3')).not.toBe(hash('p:2|b:2,3'));
  });

  it('is stable for identical normalized states', () => {
    const key = normalize({ playerIndex: 4, boxes: Uint32Array.from([1, 7]) });

    expect(hash(key)).toBe(hash(key));
  });
});
