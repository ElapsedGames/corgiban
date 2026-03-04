export type ZobristKey = {
  hi: number;
  lo: number;
};

export type ZobristTable = {
  boxHi: Uint32Array;
  boxLo: Uint32Array;
  playerHi: Uint32Array;
  playerLo: Uint32Array;
};

const DEFAULT_SEED = 0x9e3779b9;

function makePrng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z ^= z >>> 16;
    z = Math.imul(z, 0x85ebca6b) >>> 0;
    z ^= z >>> 13;
    z = Math.imul(z, 0xc2b2ae35) >>> 0;
    z ^= z >>> 16;
    return z >>> 0;
  };
}

export function createZobristTable(cellCount: number, seed = DEFAULT_SEED): ZobristTable {
  if (!Number.isInteger(cellCount) || cellCount < 0) {
    throw new Error('cellCount must be a non-negative integer.');
  }
  const prng = makePrng(seed);
  const boxHi = new Uint32Array(cellCount);
  const boxLo = new Uint32Array(cellCount);
  const playerHi = new Uint32Array(cellCount);
  const playerLo = new Uint32Array(cellCount);

  for (let index = 0; index < cellCount; index += 1) {
    boxHi[index] = prng();
    boxLo[index] = prng();
    playerHi[index] = prng();
    playerLo[index] = prng();
  }

  return { boxHi, boxLo, playerHi, playerLo };
}

export function hashState(
  table: ZobristTable,
  playerCellId: number,
  boxes: Uint16Array,
): ZobristKey {
  let hi = 0;
  let lo = 0;

  if (playerCellId >= 0) {
    hi ^= table.playerHi[playerCellId] >>> 0;
    lo ^= table.playerLo[playerCellId] >>> 0;
  }

  for (let index = 0; index < boxes.length; index += 1) {
    const cellId = boxes[index];
    hi ^= table.boxHi[cellId] >>> 0;
    lo ^= table.boxLo[cellId] >>> 0;
  }

  return { hi: hi >>> 0, lo: lo >>> 0 };
}

export function zobristKeyToBigInt(key: ZobristKey): bigint {
  return (BigInt(key.hi >>> 0) << 32n) | BigInt(key.lo >>> 0);
}
