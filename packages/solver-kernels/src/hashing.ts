export type HashStateRequest = {
  playerIndex: number;
  boxIndices: Uint16Array | Uint32Array | number[];
};

const FNV_OFFSET_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;

function fnvMix(seed: bigint, value: number): bigint {
  const normalized = BigInt(value >>> 0);
  return (seed ^ normalized) * FNV_PRIME_64;
}

export function hashState64(request: HashStateRequest): bigint {
  let hash = FNV_OFFSET_64;
  hash = fnvMix(hash, request.playerIndex);

  for (let index = 0; index < request.boxIndices.length; index += 1) {
    hash = fnvMix(hash, request.boxIndices[index]);
  }

  return hash & 0xffffffffffffffffn;
}

export function hashStatePair(request: HashStateRequest): { hi: number; lo: number } {
  const value = hashState64(request);
  return {
    hi: Number((value >> 32n) & 0xffffffffn),
    lo: Number(value & 0xffffffffn),
  };
}
