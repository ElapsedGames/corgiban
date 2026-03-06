export type ReachabilityRequest = {
  width: number;
  height: number;
  startIndex: number;
  wallMask: Uint8Array;
  blockedMask?: Uint8Array;
};

export type ReachabilityResult = {
  reachableMask: Uint8Array;
  reachableCount: number;
};

function indexInBounds(index: number, max: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < max;
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function assertMaskLength(label: string, mask: Uint8Array, expectedLength: number): void {
  if (mask.length !== expectedLength) {
    throw new Error(`${label} length must equal width * height (${expectedLength}).`);
  }
}

function isBlocked(index: number, wallMask: Uint8Array, blockedMask?: Uint8Array): boolean {
  if (wallMask[index] !== 0) {
    return true;
  }
  if (!blockedMask) {
    return false;
  }
  return blockedMask[index] !== 0;
}

export function reachabilityFloodFill(request: ReachabilityRequest): ReachabilityResult {
  const { width, height, startIndex, wallMask, blockedMask } = request;

  if (!isNonNegativeInteger(width) || !isNonNegativeInteger(height)) {
    throw new Error('width and height must be non-negative integers.');
  }

  const cellCount = width * height;
  assertMaskLength('wallMask', wallMask, cellCount);
  if (blockedMask) {
    assertMaskLength('blockedMask', blockedMask, cellCount);
  }

  if (cellCount <= 0) {
    return { reachableMask: new Uint8Array(0), reachableCount: 0 };
  }

  if (!indexInBounds(startIndex, cellCount) || isBlocked(startIndex, wallMask, blockedMask)) {
    return { reachableMask: new Uint8Array(cellCount), reachableCount: 0 };
  }

  const reachableMask = new Uint8Array(cellCount);
  const queue = new Uint32Array(cellCount);

  let head = 0;
  let tail = 0;
  queue[tail] = startIndex;
  tail += 1;
  reachableMask[startIndex] = 1;

  while (head < tail) {
    const index = queue[head];
    head += 1;

    const row = Math.floor(index / width);
    const col = index % width;
    if (row > 0) {
      const upIndex = index - width;
      if (reachableMask[upIndex] === 0 && !isBlocked(upIndex, wallMask, blockedMask)) {
        reachableMask[upIndex] = 1;
        queue[tail] = upIndex;
        tail += 1;
      }
    }

    if (row + 1 < height) {
      const downIndex = index + width;
      if (reachableMask[downIndex] === 0 && !isBlocked(downIndex, wallMask, blockedMask)) {
        reachableMask[downIndex] = 1;
        queue[tail] = downIndex;
        tail += 1;
      }
    }

    if (col > 0) {
      const leftIndex = index - 1;
      if (reachableMask[leftIndex] === 0 && !isBlocked(leftIndex, wallMask, blockedMask)) {
        reachableMask[leftIndex] = 1;
        queue[tail] = leftIndex;
        tail += 1;
      }
    }

    if (col + 1 < width) {
      const rightIndex = index + 1;
      if (reachableMask[rightIndex] === 0 && !isBlocked(rightIndex, wallMask, blockedMask)) {
        reachableMask[rightIndex] = 1;
        queue[tail] = rightIndex;
        tail += 1;
      }
    }
  }

  return {
    reachableMask,
    reachableCount: tail,
  };
}
