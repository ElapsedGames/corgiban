import { describe, expect, it } from 'vitest';

import type { LevelDefinition } from '@corgiban/levels';

import {
  benchmarkLevelDifficulty,
  buildSuggestedLevelOrder,
  compareLevelDifficulty,
  formatLevelDifficultyReport,
  hasLevelDifficultyFailures,
  rankLevelDifficultyResults,
  type LevelDifficultyResult,
} from '../levelDifficultyReport';

function createResult(
  overrides: Partial<LevelDifficultyResult> & Pick<LevelDifficultyResult, 'levelId' | 'name'>,
): LevelDifficultyResult {
  return {
    levelId: overrides.levelId,
    name: overrides.name,
    status: overrides.status ?? 'solved',
    withinTimeBudget: overrides.withinTimeBudget ?? true,
    solutionPushCount: overrides.solutionPushCount ?? 1,
    solutionMoveCount: overrides.solutionMoveCount ?? 3,
    elapsedMs: overrides.elapsedMs ?? 5,
    expanded: overrides.expanded ?? 4,
    generated: overrides.generated ?? 6,
    maxDepth: overrides.maxDepth ?? 1,
    maxFrontier: overrides.maxFrontier ?? 1,
    boxCount: overrides.boxCount ?? 1,
    walkableCount: overrides.walkableCount ?? 4,
    reachableCount: overrides.reachableCount ?? 4,
    ...(overrides.errorMessage ? { errorMessage: overrides.errorMessage } : {}),
    ...(overrides.errorDetails ? { errorDetails: overrides.errorDetails } : {}),
  };
}

describe('levelDifficultyReport sorting', () => {
  it('prefers fewer pushes over slightly lower runtime in default difficulty mode', () => {
    const easier = createResult({
      levelId: 'easy',
      name: 'Easy',
      solutionPushCount: 1,
      solutionMoveCount: 4,
      elapsedMs: 8,
      generated: 10,
    });
    const harder = createResult({
      levelId: 'hard',
      name: 'Hard',
      solutionPushCount: 2,
      solutionMoveCount: 2,
      elapsedMs: 1,
      generated: 2,
    });

    expect(compareLevelDifficulty(easier, harder, 'difficulty')).toBeLessThan(0);
    expect(buildSuggestedLevelOrder([harder, easier], 'difficulty')).toEqual(['easy', 'hard']);
  });

  it('keeps failed levels behind solved levels regardless of zero push metrics', () => {
    const solved = createResult({ levelId: 'solved', name: 'Solved' });
    const timeout = createResult({
      levelId: 'timeout',
      name: 'Timeout',
      status: 'timeout',
      withinTimeBudget: false,
      solutionPushCount: null,
      solutionMoveCount: null,
      elapsedMs: 15_000,
    });

    const ranked = rankLevelDifficultyResults([timeout, solved], 'pushes');
    expect(ranked.map((result) => result.levelId)).toEqual(['solved', 'timeout']);
  });

  it('reports limit failures for timeouts and unsolved levels', () => {
    const solved = createResult({ levelId: 'solved', name: 'Solved' });
    const unsolved = createResult({
      levelId: 'unsolved',
      name: 'Unsolved',
      status: 'unsolved',
      withinTimeBudget: false,
      solutionPushCount: null,
      solutionMoveCount: null,
    });

    expect(hasLevelDifficultyFailures([solved])).toBe(false);
    expect(hasLevelDifficultyFailures([solved, unsolved])).toBe(true);
  });

  it('formats a readable report with a failure section', () => {
    const report = formatLevelDifficultyReport(
      [
        createResult({ levelId: 'easy', name: 'Easy' }),
        createResult({
          levelId: 'timeout',
          name: 'Timeout',
          status: 'timeout',
          withinTimeBudget: false,
          solutionPushCount: null,
          solutionMoveCount: null,
          elapsedMs: 15_000,
        }),
      ],
      {
        algorithmId: 'bfsPush',
        timeBudgetMs: 15_000,
        nodeBudget: 2_000_000,
        sortBy: 'difficulty',
      },
    );

    expect(report).toContain('Suggested level order:');
    expect(report).toContain('easy | Easy | solved');
    expect(report).toContain('Over budget or unsolved:');
    expect(report).toContain('timeout | Timeout | timeout');
  });
});

describe('benchmarkLevelDifficulty', () => {
  it('benchmarks simple levels and exposes solved move/push counts', async () => {
    const levels: LevelDefinition[] = [
      {
        id: 'single-push',
        name: 'Single Push',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
      {
        id: 'already-solved',
        name: 'Already Solved',
        rows: ['P'],
      },
    ];

    const results = await benchmarkLevelDifficulty(levels, {
      environment: {
        userAgent: 'vitest',
        hardwareConcurrency: 1,
        appVersion: 'test',
      },
      timeBudgetMs: 1_000,
      nodeBudget: 10_000,
    });

    const byId = new Map(results.map((result) => [result.levelId, result]));
    expect(byId.get('single-push')?.status).toBe('solved');
    expect(byId.get('single-push')?.solutionPushCount).toBe(1);
    expect(byId.get('single-push')?.solutionMoveCount).toBe(1);
    expect(byId.get('already-solved')?.status).toBe('solved');
    expect(byId.get('already-solved')?.solutionPushCount).toBe(0);
  });
});
