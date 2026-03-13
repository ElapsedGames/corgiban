import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseLevel } from '@corgiban/core';

import {
  createAnalyzeLevelStressLevelDefinition,
  createAnalyzeLevelStressLevelJson,
  getSlowestBuiltinAnalyzeLevelSample,
  rankBuiltinAnalyzeLevelCost,
} from '../analyzeLevelProfile';

function countToken(rows: string[], token: string): number {
  return rows.reduce((total, row) => total + row.split(token).length - 1, 0);
}

describe('analyzeLevelProfile', () => {
  afterEach(() => {
    vi.doUnmock('@corgiban/levels');
    vi.resetModules();
  });

  it('builds a parseable stress level with matching box and goal counts', () => {
    const level = createAnalyzeLevelStressLevelDefinition();
    const runtime = parseLevel(level);

    expect(runtime.width).toBe(64);
    expect(runtime.height).toBe(64);
    expect(countToken(level.rows, 'B') + countToken(level.rows, 'S')).toBe(40);
    expect(countToken(level.rows, 'T') + countToken(level.rows, 'S')).toBe(40);
  });

  it('supports custom dimensions and box counts', () => {
    const level = createAnalyzeLevelStressLevelDefinition({
      width: 12,
      height: 10,
      boxCount: 6,
    });

    expect(level.id).toBe('profile-stress-12x10-6');
    expect(level.rows).toHaveLength(10);
    expect(level.rows[0]).toHaveLength(12);
    expect(countToken(level.rows, 'B') + countToken(level.rows, 'S')).toBe(6);
    expect(countToken(level.rows, 'T') + countToken(level.rows, 'S')).toBe(6);
  });

  it('serializes the stress level as formatted JSON', () => {
    const serialized = createAnalyzeLevelStressLevelJson({
      width: 10,
      height: 8,
      boxCount: 4,
    });

    expect(JSON.parse(serialized)).toMatchObject({
      id: 'profile-stress-10x8-4',
      name: 'Profile Stress 10x8 (4 boxes)',
    });
  });

  it('rejects dimensions that cannot hold the requested boxes and goals', () => {
    expect(() =>
      createAnalyzeLevelStressLevelDefinition({
        width: 6,
        height: 6,
        boxCount: 9,
      }),
    ).toThrow('Stress level dimensions do not have enough interior space for boxes and goals.');
  });

  it('profiles built-in levels and returns the slowest sample first', () => {
    const ranked = rankBuiltinAnalyzeLevelCost({
      iterations: 1,
      warmupIterations: 0,
    });
    const slowest = getSlowestBuiltinAnalyzeLevelSample({ iterations: 1, warmupIterations: 0 });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.meanMs).toBeGreaterThanOrEqual(ranked.at(-1)?.meanMs ?? 0);
    expect(ranked.some((sample) => sample.levelId === slowest.levelId)).toBe(true);
    expect(slowest.meanMs).toBeGreaterThanOrEqual(0);
  });

  it('runs warmup iterations before measuring built-in levels', () => {
    const ranked = rankBuiltinAnalyzeLevelCost({
      iterations: 1,
      warmupIterations: 1,
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked[0]?.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects invalid stress-level dimensions and box counts before generation', () => {
    expect(() => createAnalyzeLevelStressLevelDefinition({ width: 5 })).toThrow(
      'Stress level width must be an integer >= 6.',
    );
    expect(() => createAnalyzeLevelStressLevelDefinition({ height: 5 })).toThrow(
      'Stress level height must be an integer >= 6.',
    );
    expect(() => createAnalyzeLevelStressLevelDefinition({ boxCount: 0 })).toThrow(
      'Stress level boxCount must be an integer >= 1.',
    );
  });

  it('throws when no built-in levels are available to profile', async () => {
    vi.doMock('@corgiban/levels', async () => {
      const actual = await vi.importActual<typeof import('@corgiban/levels')>('@corgiban/levels');
      return {
        ...actual,
        builtinLevels: [],
      };
    });

    const { getSlowestBuiltinAnalyzeLevelSample: getSlowestWithNoBuiltins } =
      await import('../analyzeLevelProfile');

    expect(() => getSlowestWithNoBuiltins()).toThrow(
      'No built-in levels are available for analyzeLevel profiling.',
    );
  });
});
