import type { LevelRuntime } from '@corgiban/core';
import { isWall } from '@corgiban/core';

import type { AlgorithmId, LevelFeatures } from './solverTypes';
import { DEFAULT_ALGORITHM_ID, isImplementedAlgorithmId } from './solverConstants';
import { compileLevel } from '../state/compiledLevel';

const DIRECTION_DELTAS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

export function analyzeLevel(level: LevelRuntime): LevelFeatures {
  const { width, height, staticGrid, initialPlayerIndex } = level;
  const size = width * height;

  let walkableCount = 0;
  for (let index = 0; index < size; index += 1) {
    if (!isWall(staticGrid[index])) {
      walkableCount += 1;
    }
  }

  const boxCount = level.initialBoxes.length;
  const blocked = new Uint8Array(size);
  for (let index = 0; index < level.initialBoxes.length; index += 1) {
    blocked[level.initialBoxes[index]] = 1;
  }

  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 0;
  let reachableCount = 0;

  if (!blocked[initialPlayerIndex] && !isWall(staticGrid[initialPlayerIndex])) {
    visited[initialPlayerIndex] = 1;
    queue[tail] = initialPlayerIndex;
    tail += 1;
    reachableCount += 1;
  }

  while (head < tail) {
    const current = queue[head];
    head += 1;
    const row = Math.floor(current / width);
    const col = current % width;

    for (const delta of DIRECTION_DELTAS) {
      const nextRow = row + delta.dy;
      const nextCol = col + delta.dx;
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) {
        continue;
      }
      const nextIndex = nextRow * width + nextCol;
      if (visited[nextIndex]) {
        continue;
      }
      if (blocked[nextIndex]) {
        continue;
      }
      if (isWall(staticGrid[nextIndex])) {
        continue;
      }
      visited[nextIndex] = 1;
      queue[tail] = nextIndex;
      tail += 1;
      reachableCount += 1;
    }
  }

  const compiled = compileLevel(level);
  let tunnelCellCount = 0;
  for (let index = 0; index < compiled.tunnelDirections.length; index += 1) {
    if (compiled.tunnelDirections[index] !== 0) {
      tunnelCellCount += 1;
    }
  }

  const boxDensity = walkableCount === 0 ? 0 : boxCount / walkableCount;
  const reachableRatio = walkableCount === 0 ? 0 : reachableCount / walkableCount;
  const tunnelRatio = walkableCount === 0 ? 0 : tunnelCellCount / walkableCount;

  return {
    width,
    height,
    boxCount,
    walkableCount,
    reachableCount,
    boxDensity,
    reachableRatio,
    tunnelCellCount,
    tunnelRatio,
  };
}

export function chooseAlgorithm(features: LevelFeatures): AlgorithmId {
  const { boxCount, boxDensity, reachableRatio, tunnelCellCount, tunnelRatio } = features;

  let preferredAlgorithm: AlgorithmId;
  if (tunnelCellCount >= 4 && tunnelRatio >= 0.18) {
    preferredAlgorithm = 'tunnelMacroPush';
  } else if (boxCount >= 7 && (reachableRatio <= 0.72 || boxDensity >= 0.1)) {
    preferredAlgorithm = 'piCorralPush';
  } else if (boxCount <= 2 && reachableRatio >= 0.7 && boxDensity <= 0.1) {
    preferredAlgorithm = 'greedyPush';
  } else if (boxCount <= 3) {
    preferredAlgorithm = 'bfsPush';
  } else if (boxCount <= 6) {
    preferredAlgorithm = 'astarPush';
  } else {
    preferredAlgorithm = 'idaStarPush';
  }

  if (isImplementedAlgorithmId(preferredAlgorithm)) {
    return preferredAlgorithm;
  }

  // Keep forward-looking recommendation rules but never return unavailable ids.
  return DEFAULT_ALGORITHM_ID;
}
