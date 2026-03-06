import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { analyzeLevel, chooseAlgorithm } from '../selection';
import type { LevelFeatures } from '../solverTypes';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('selection', () => {
  it('analyzes box counts, dimensions, and reachability', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WBEWW', 'WWWWW']);
    const features = analyzeLevel(level);

    expect(features.width).toBe(5);
    expect(features.height).toBe(4);
    expect(features.boxCount).toBe(1);
    expect(features.walkableCount).toBe(5);
    expect(features.reachableCount).toBe(4);
  });

  it('handles minimal grids with no boxes', () => {
    const level = buildLevel(['P']);
    const features = analyzeLevel(level);

    expect(features.boxCount).toBe(0);
    expect(features.walkableCount).toBe(1);
    expect(features.reachableCount).toBe(1);
  });

  it('handles max box counts', () => {
    const row = `WP${'B'.repeat(40)}W`;
    const level = buildLevel([row]);
    const features = analyzeLevel(level);

    expect(features.boxCount).toBe(40);
  });

  it('reports disconnected walkable regions even when there are no boxes', () => {
    const level = buildLevel(['WWWWWWW', 'WPEWEEW', 'WWWWWWW']);
    const features = analyzeLevel(level);

    expect(features.boxCount).toBe(0);
    expect(features.walkableCount).toBe(4);
    expect(features.reachableCount).toBe(2);
    expect(features.reachableCount).toBeLessThan(features.walkableCount);
  });

  it('reports zero reachability when player is on a wall cell', () => {
    const level = {
      levelId: 'blocked-start',
      width: 1,
      height: 1,
      staticGrid: Uint8Array.from([0]),
      initialPlayerIndex: 0,
      initialBoxes: Uint32Array.from([]),
    };
    const features = analyzeLevel(level);

    expect(features.walkableCount).toBe(0);
    expect(features.reachableCount).toBe(0);
  });

  it('chooses bfsPush for small box counts', () => {
    const features: LevelFeatures = {
      width: 3,
      height: 3,
      boxCount: 3,
      walkableCount: 5,
      reachableCount: 5,
    };

    expect(chooseAlgorithm(features)).toBe('bfsPush');
  });

  it.each([
    {
      label: 'lower A* boundary',
      features: {
        width: 4,
        height: 4,
        boxCount: 4,
        walkableCount: 10,
        reachableCount: 8,
      },
    },
    {
      label: 'upper A* boundary',
      features: {
        width: 5,
        height: 5,
        boxCount: 6,
        walkableCount: 12,
        reachableCount: 10,
      },
    },
    {
      label: 'large-box fallback range',
      features: {
        width: 8,
        height: 8,
        boxCount: 12,
        walkableCount: 40,
        reachableCount: 32,
      },
    },
  ])(
    'falls back to bfsPush for the $label until non-BFS algorithms are implemented',
    ({ features }) => {
      expect(chooseAlgorithm(features)).toBe('bfsPush');
    },
  );
});
