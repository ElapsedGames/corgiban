export class Bitset {
  readonly size: number;
  readonly words: Uint32Array;

  constructor(size: number) {
    if (!Number.isInteger(size) || size < 0) {
      throw new Error('Bitset size must be a non-negative integer.');
    }
    this.size = size;
    this.words = new Uint32Array(Math.ceil(size / 32));
  }

  clone(): Bitset {
    const next = new Bitset(this.size);
    next.words.set(this.words);
    return next;
  }

  has(index: number): boolean {
    if (index < 0 || index >= this.size) {
      throw new Error(`Bitset index ${index} is out of bounds.`);
    }
    const wordIndex = index >>> 5;
    const mask = 1 << (index & 31);
    return (this.words[wordIndex] & mask) !== 0;
  }

  set(index: number, value = true): void {
    if (index < 0 || index >= this.size) {
      throw new Error(`Bitset index ${index} is out of bounds.`);
    }
    const wordIndex = index >>> 5;
    const mask = 1 << (index & 31);
    if (value) {
      this.words[wordIndex] |= mask;
    } else {
      this.words[wordIndex] &= ~mask;
    }
  }

  clear(): void {
    this.words.fill(0);
  }

  fill(value: boolean): void {
    this.words.fill(value ? 0xffffffff : 0);
  }

  toArray(): number[] {
    const result: number[] = [];
    for (let index = 0; index < this.size; index += 1) {
      if (this.has(index)) {
        result.push(index);
      }
    }
    return result;
  }
}

export function bitsetFromIndices(size: number, indices: Iterable<number>): Bitset {
  const bitset = new Bitset(size);
  for (const index of indices) {
    bitset.set(index, true);
  }
  return bitset;
}
