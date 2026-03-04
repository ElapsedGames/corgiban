import { describe, expect, it } from 'vitest';

import { hash } from '../hash';
import { normalize } from '../normalize';

describe('hash', () => {
  it('returns an unsigned 32-bit integer', () => {
    const value = hash('p:1|b:2,3');

    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(2 ** 32);
  });

  it('changes when the key changes', () => {
    expect(hash('p:1|b:2,3')).not.toBe(hash('p:2|b:2,3'));
  });

  it('produces different hashes for states that differ only by player position', () => {
    const keyA = normalize({ playerIndex: 4, boxes: Uint32Array.from([1, 7]) });
    const keyB = normalize({ playerIndex: 5, boxes: Uint32Array.from([1, 7]) });

    expect(hash(keyA)).not.toBe(hash(keyB));
  });
});
