import { describe, expect, it } from 'vitest';

import { createZobristTable, hashState, zobristKeyToBigInt } from '../zobrist';

describe('zobrist', () => {
  it('different seeds produce different tables', () => {
    const tableA = createZobristTable(4, 123);
    const tableB = createZobristTable(4, 456);

    // Seeds drive the PRNG; distinct seeds must yield distinct random values
    expect(tableA.boxHi).not.toEqual(tableB.boxHi);
  });

  it('different player positions produce different hashes', () => {
    const table = createZobristTable(8, 42);
    const boxes = Uint16Array.from([3]);

    const keyA = hashState(table, 1, boxes);
    const keyB = hashState(table, 2, boxes);

    expect(keyA).not.toEqual(keyB);
  });

  it('hash is order independent for box list', () => {
    const table = createZobristTable(8, 7);
    const keyA = hashState(table, 3, Uint16Array.from([1, 4]));
    const keyB = hashState(table, 3, Uint16Array.from([4, 1]));

    expect(keyA).toEqual(keyB);
  });

  it('converts keys to bigint', () => {
    const key = { hi: 0x01020304, lo: 0x05060708 };
    const big = zobristKeyToBigInt(key);

    expect(big).toBe((BigInt(0x01020304) << 32n) | BigInt(0x05060708));
  });

  it('supports zero-cell tables', () => {
    const table = createZobristTable(0);

    expect(table.boxHi).toHaveLength(0);
    expect(table.boxLo).toHaveLength(0);
    expect(table.playerHi).toHaveLength(0);
    expect(table.playerLo).toHaveLength(0);
    expect(hashState(table, -1, new Uint16Array(0))).toEqual({ hi: 0, lo: 0 });
  });

  it('throws when cellCount is not a non-negative integer', () => {
    expect(() => createZobristTable(-1)).toThrow('non-negative integer');
    expect(() => createZobristTable(2.5)).toThrow('non-negative integer');
  });
});
