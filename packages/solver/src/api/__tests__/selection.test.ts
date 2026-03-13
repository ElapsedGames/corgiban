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
    expect(features.boxDensity).toBe(0.2);
    expect(features.reachableRatio).toBe(0.8);
    expect(features.tunnelCellCount).toBe(0);
    expect(features.tunnelRatio).toBe(0);
  });

  it('counts tunnel metadata for straight corridor levels', () => {
    const level = buildLevel(['WWWWWWWWW', 'WPBEEEETW', 'WWWWWWWWW']);
    const features = analyzeLevel(level);

    expect(features.tunnelCellCount).toBe(5);
    expect(features.tunnelRatio).toBe(5 / 7);
  });

  it('handles minimal grids with no boxes', () => {
    const level = buildLevel(['P']);
    const features = analyzeLevel(level);

    expect(features.boxCount).toBe(0);
    expect(features.walkableCount).toBe(1);
    expect(features.reachableCount).toBe(1);
    expect(features.boxDensity).toBe(0);
    expect(features.reachableRatio).toBe(1);
    expect(features.tunnelCellCount).toBe(0);
    expect(features.tunnelRatio).toBe(0);
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
    expect(features.reachableRatio).toBe(0.5);
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
    expect(features.boxDensity).toBe(0);
    expect(features.reachableRatio).toBe(0);
    expect(features.tunnelCellCount).toBe(0);
    expect(features.tunnelRatio).toBe(0);
  });

  it('chooses tunnelMacroPush when tunnel-heavy levels meet the tunnel rule', () => {
    const features: LevelFeatures = {
      width: 9,
      height: 3,
      boxCount: 1,
      walkableCount: 7,
      reachableCount: 7,
      boxDensity: 1 / 7,
      reachableRatio: 1,
      tunnelCellCount: 4,
      tunnelRatio: 4 / 7,
    };

    expect(chooseAlgorithm(features)).toBe('tunnelMacroPush');
  });

  it('chooses piCorralPush for dense or constrained high-box levels', () => {
    const features: LevelFeatures = {
      width: 8,
      height: 8,
      boxCount: 8,
      walkableCount: 40,
      reachableCount: 24,
      boxDensity: 0.2,
      reachableRatio: 0.6,
      tunnelCellCount: 0,
      tunnelRatio: 0,
    };

    expect(chooseAlgorithm(features)).toBe('piCorralPush');
  });

  it('chooses greedyPush for low-density easy levels', () => {
    const features: LevelFeatures = {
      width: 5,
      height: 5,
      boxCount: 2,
      walkableCount: 30,
      reachableCount: 24,
      boxDensity: 2 / 30,
      reachableRatio: 24 / 30,
      tunnelCellCount: 0,
      tunnelRatio: 0,
    };

    expect(chooseAlgorithm(features)).toBe('greedyPush');
  });

  it('chooses bfsPush for small levels that do not qualify for greedy or tunnel rules', () => {
    const features: LevelFeatures = {
      width: 4,
      height: 4,
      boxCount: 3,
      walkableCount: 8,
      reachableCount: 5,
      boxDensity: 3 / 8,
      reachableRatio: 5 / 8,
      tunnelCellCount: 1,
      tunnelRatio: 1 / 8,
    };

    expect(chooseAlgorithm(features)).toBe('bfsPush');
  });

  it('chooses astarPush for mid-sized levels outside tunnel rules', () => {
    const features: LevelFeatures = {
      width: 5,
      height: 5,
      boxCount: 6,
      walkableCount: 20,
      reachableCount: 15,
      boxDensity: 0.3,
      reachableRatio: 0.75,
      tunnelCellCount: 2,
      tunnelRatio: 0.1,
    };

    expect(chooseAlgorithm(features)).toBe('astarPush');
  });

  it('chooses idaStarPush for larger open levels that miss pi-corral conditions', () => {
    const features: LevelFeatures = {
      width: 8,
      height: 8,
      boxCount: 9,
      walkableCount: 100,
      reachableCount: 90,
      boxDensity: 0.09,
      reachableRatio: 0.9,
      tunnelCellCount: 0,
      tunnelRatio: 0,
    };

    expect(chooseAlgorithm(features)).toBe('idaStarPush');
  });
});
