import type { ZobristKey } from './zobrist';
import { zobristKeyToBigInt } from './zobrist';

export type StateFingerprint = {
  player: number;
  boxes: Uint16Array;
};

type BucketEntry = {
  player: number;
  boxes: Uint16Array;
};

function fingerprintsEqual(left: StateFingerprint, right: BucketEntry): boolean {
  if (left.player !== right.player) {
    return false;
  }
  if (left.boxes.length !== right.boxes.length) {
    return false;
  }
  for (let index = 0; index < left.boxes.length; index += 1) {
    if (left.boxes[index] !== right.boxes[index]) {
      return false;
    }
  }
  return true;
}

export class VisitedSet {
  private readonly buckets = new Map<bigint, BucketEntry[]>();

  get size(): number {
    return this.buckets.size;
  }

  has(key: ZobristKey, fingerprint: StateFingerprint): boolean {
    const bucket = this.buckets.get(zobristKeyToBigInt(key));
    if (!bucket) {
      return false;
    }
    for (const entry of bucket) {
      if (fingerprintsEqual(fingerprint, entry)) {
        return true;
      }
    }
    return false;
  }

  add(key: ZobristKey, fingerprint: StateFingerprint): void {
    const bucketKey = zobristKeyToBigInt(key);
    const bucket = this.buckets.get(bucketKey);
    const entry: BucketEntry = {
      player: fingerprint.player,
      boxes: Uint16Array.from(fingerprint.boxes),
    };

    if (bucket) {
      bucket.push(entry);
    } else {
      this.buckets.set(bucketKey, [entry]);
    }
  }

  checkAndAdd(key: ZobristKey, fingerprint: StateFingerprint): boolean {
    const bucketKey = zobristKeyToBigInt(key);
    const bucket = this.buckets.get(bucketKey);
    if (!bucket) {
      this.buckets.set(bucketKey, [
        { player: fingerprint.player, boxes: Uint16Array.from(fingerprint.boxes) },
      ]);
      return false;
    }

    for (const entry of bucket) {
      if (fingerprintsEqual(fingerprint, entry)) {
        return true;
      }
    }

    bucket.push({ player: fingerprint.player, boxes: Uint16Array.from(fingerprint.boxes) });
    return false;
  }
}
