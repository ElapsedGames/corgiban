import { describe, expect, it } from 'vitest';

import type { LevelDefinition } from '@corgiban/levels';

import {
  benchmarkLevelDifficulty,
  buildSuggestedLevelOrder,
  compareLevelDifficulty,
  formatLevelDifficultyReport,
  hasLevelDifficultyFailures,
  LEVEL_DIFFICULTY_SORTS,
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

  it('orders every solve status bucket from easiest to hardest', () => {
    const ranked = rankLevelDifficultyResults([
      createResult({
        levelId: 'cancelled',
        name: 'Cancelled',
        status: 'cancelled',
        withinTimeBudget: false,
        solutionMoveCount: null,
        solutionPushCount: null,
      }),
      createResult({
        levelId: 'error',
        name: 'Error',
        status: 'error',
        withinTimeBudget: false,
        solutionMoveCount: null,
        solutionPushCount: null,
      }),
      createResult({
        levelId: 'timeout',
        name: 'Timeout',
        status: 'timeout',
        withinTimeBudget: false,
        solutionMoveCount: null,
        solutionPushCount: null,
      }),
      createResult({
        levelId: 'unsolved',
        name: 'Unsolved',
        status: 'unsolved',
        withinTimeBudget: false,
        solutionMoveCount: null,
        solutionPushCount: null,
      }),
      createResult({
        levelId: 'over-budget',
        name: 'Over Budget',
        status: 'solved',
        withinTimeBudget: false,
      }),
      createResult({ levelId: 'solved', name: 'Solved' }),
    ]);

    expect(ranked.map((result) => result.levelId)).toEqual([
      'solved',
      'over-budget',
      'timeout',
      'unsolved',
      'error',
      'cancelled',
    ]);
  });

  it('uses elapsed time first when ordering failure tails', () => {
    const quickerFailure = createResult({
      levelId: 'quick-timeout',
      name: 'Quick Timeout',
      status: 'timeout',
      withinTimeBudget: false,
      elapsedMs: 100,
      solutionMoveCount: null,
      solutionPushCount: null,
    });
    const slowerFailure = createResult({
      levelId: 'slow-timeout',
      name: 'Slow Timeout',
      status: 'timeout',
      withinTimeBudget: false,
      elapsedMs: 200,
      solutionMoveCount: null,
      solutionPushCount: null,
    });

    expect(compareLevelDifficulty(quickerFailure, slowerFailure, 'difficulty')).toBeLessThan(0);
  });

  it('falls back to generated, expanded, then level id for failure tails', () => {
    const generatedTieBreaker = createResult({
      elapsedMs: 100,
      expanded: 20,
      generated: 40,
      levelId: 'generated-first',
      name: 'Generated First',
      status: 'timeout',
      withinTimeBudget: false,
      solutionMoveCount: null,
      solutionPushCount: null,
    });
    const expandedTieBreaker = createResult({
      elapsedMs: 100,
      expanded: 30,
      generated: 40,
      levelId: 'expanded-second',
      name: 'Expanded Second',
      status: 'timeout',
      withinTimeBudget: false,
      solutionMoveCount: null,
      solutionPushCount: null,
    });
    const levelIdTieBreaker = createResult({
      elapsedMs: 100,
      expanded: 30,
      generated: 40,
      levelId: 'zebra',
      name: 'Zebra',
      status: 'timeout',
      withinTimeBudget: false,
      solutionMoveCount: null,
      solutionPushCount: null,
    });

    const ranked = rankLevelDifficultyResults(
      [levelIdTieBreaker, expandedTieBreaker, generatedTieBreaker],
      'difficulty',
    );
    expect(ranked.map((result) => result.levelId)).toEqual([
      'generated-first',
      'expanded-second',
      'zebra',
    ]);
  });

  it('uses push count, then moves, then elapsed time for push sorting', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          elapsedMs: 8,
          levelId: 'later',
          name: 'Later',
          solutionMoveCount: 3,
          solutionPushCount: 1,
        }),
        createResult({
          elapsedMs: 4,
          levelId: 'fewer-moves',
          name: 'Fewer Moves',
          solutionMoveCount: 2,
          solutionPushCount: 1,
        }),
        createResult({
          elapsedMs: 1,
          levelId: 'more-pushes',
          name: 'More Pushes',
          solutionMoveCount: 1,
          solutionPushCount: 2,
        }),
      ],
      'pushes',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['fewer-moves', 'later', 'more-pushes']);
  });

  it('uses move count, then pushes, then elapsed time for move sorting', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          elapsedMs: 5,
          levelId: 'later',
          name: 'Later',
          solutionMoveCount: 3,
          solutionPushCount: 1,
        }),
        createResult({
          elapsedMs: 4,
          levelId: 'fewer-pushes',
          name: 'Fewer Pushes',
          solutionMoveCount: 3,
          solutionPushCount: 0,
        }),
        createResult({
          elapsedMs: 1,
          levelId: 'more-moves',
          name: 'More Moves',
          solutionMoveCount: 4,
          solutionPushCount: 0,
        }),
      ],
      'moves',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['fewer-pushes', 'later', 'more-moves']);
  });

  it('uses generated states before solution length tie breakers for generated sorting', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          generated: 20,
          levelId: 'more-generated',
          name: 'More Generated',
          solutionMoveCount: 1,
          solutionPushCount: 1,
        }),
        createResult({
          generated: 10,
          levelId: 'fewer-generated',
          name: 'Fewer Generated',
          solutionMoveCount: 4,
          solutionPushCount: 3,
        }),
      ],
      'generated',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['fewer-generated', 'more-generated']);
  });

  it('uses elapsed time before generated states for elapsed sorting', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          elapsedMs: 15,
          generated: 1,
          levelId: 'slower',
          name: 'Slower',
          solutionMoveCount: 1,
          solutionPushCount: 1,
        }),
        createResult({
          elapsedMs: 5,
          generated: 99,
          levelId: 'faster',
          name: 'Faster',
          solutionMoveCount: 3,
          solutionPushCount: 2,
        }),
      ],
      'elapsed',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['faster', 'slower']);
  });

  it('uses box count, reachable count, and level id as late tie breakers in difficulty mode', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          boxCount: 3,
          elapsedMs: 10,
          expanded: 20,
          generated: 20,
          levelId: 'beta',
          name: 'Beta',
          reachableCount: 6,
          solutionMoveCount: 4,
          solutionPushCount: 2,
        }),
        createResult({
          boxCount: 2,
          elapsedMs: 10,
          expanded: 20,
          generated: 20,
          levelId: 'alpha',
          name: 'Alpha',
          reachableCount: 9,
          solutionMoveCount: 4,
          solutionPushCount: 2,
        }),
        createResult({
          boxCount: 2,
          elapsedMs: 10,
          expanded: 20,
          generated: 20,
          levelId: 'abacus',
          name: 'Abacus',
          reachableCount: 9,
          solutionMoveCount: 4,
          solutionPushCount: 2,
        }),
        createResult({
          boxCount: 2,
          elapsedMs: 10,
          expanded: 20,
          generated: 20,
          levelId: 'aardvark',
          name: 'Aardvark',
          reachableCount: 10,
          solutionMoveCount: 4,
          solutionPushCount: 2,
        }),
      ],
      'difficulty',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['abacus', 'alpha', 'aardvark', 'beta']);
  });

  it('treats null solution counts as least favorable when sorting solved runs', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          levelId: 'missing-metrics',
          name: 'Missing Metrics',
          solutionMoveCount: null,
          solutionPushCount: null,
        }),
        createResult({
          levelId: 'measured',
          name: 'Measured',
          solutionMoveCount: 2,
          solutionPushCount: 1,
        }),
      ],
      'pushes',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['measured', 'missing-metrics']);
  });

  it('treats solved runs over budget as failures', () => {
    expect(
      hasLevelDifficultyFailures([
        createResult({
          levelId: 'over-budget',
          name: 'Over Budget',
          status: 'solved',
          withinTimeBudget: false,
        }),
      ]),
    ).toBe(true);
  });

  it('omits the failure section when every level is solved within budget', () => {
    const report = formatLevelDifficultyReport([createResult({ levelId: 'easy', name: 'Easy' })], {
      algorithmId: 'bfsPush',
      nodeBudget: 500,
      sortBy: 'difficulty',
      timeBudgetMs: 100,
    });

    expect(report).not.toContain('Over budget or unsolved:');
  });

  it('keeps null solution metrics behind measured values for move sorting as well', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          levelId: 'null-moves',
          name: 'Null Moves',
          solutionMoveCount: null,
          solutionPushCount: 0,
        }),
        createResult({
          levelId: 'measured-moves',
          name: 'Measured Moves',
          solutionMoveCount: 2,
          solutionPushCount: 3,
        }),
      ],
      'moves',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['measured-moves', 'null-moves']);
  });

  it('uses elapsed time and then level id to break push-sort ties', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          levelId: 'beta',
          name: 'Beta',
          solutionPushCount: 1,
          solutionMoveCount: 2,
          elapsedMs: 5,
        }),
        createResult({
          levelId: 'alpha',
          name: 'Alpha',
          solutionPushCount: 1,
          solutionMoveCount: 2,
          elapsedMs: 5,
        }),
        createResult({
          levelId: 'slower',
          name: 'Slower',
          solutionPushCount: 1,
          solutionMoveCount: 2,
          elapsedMs: 8,
        }),
      ],
      'pushes',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['alpha', 'beta', 'slower']);
  });

  it('uses elapsed time and then level id to break move-sort ties', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          levelId: 'beta',
          name: 'Beta',
          solutionMoveCount: 2,
          solutionPushCount: 1,
          elapsedMs: 5,
        }),
        createResult({
          levelId: 'alpha',
          name: 'Alpha',
          solutionMoveCount: 2,
          solutionPushCount: 1,
          elapsedMs: 5,
        }),
        createResult({
          levelId: 'slower',
          name: 'Slower',
          solutionMoveCount: 2,
          solutionPushCount: 1,
          elapsedMs: 8,
        }),
      ],
      'moves',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['alpha', 'beta', 'slower']);
  });

  it('uses solution metrics, elapsed time, and level id to break generated-sort ties', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          levelId: 'beta',
          name: 'Beta',
          generated: 10,
          solutionPushCount: 1,
          solutionMoveCount: 2,
          elapsedMs: 5,
        }),
        createResult({
          levelId: 'alpha',
          name: 'Alpha',
          generated: 10,
          solutionPushCount: 1,
          solutionMoveCount: 2,
          elapsedMs: 5,
        }),
        createResult({
          levelId: 'slower',
          name: 'Slower',
          generated: 10,
          solutionPushCount: 1,
          solutionMoveCount: 2,
          elapsedMs: 8,
        }),
      ],
      'generated',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['alpha', 'beta', 'slower']);
  });

  it('uses generated count and then level id to break elapsed-sort ties', () => {
    const ranked = rankLevelDifficultyResults(
      [
        createResult({
          levelId: 'beta',
          name: 'Beta',
          elapsedMs: 5,
          solutionPushCount: 1,
          solutionMoveCount: 2,
          generated: 10,
        }),
        createResult({
          levelId: 'alpha',
          name: 'Alpha',
          elapsedMs: 5,
          solutionPushCount: 1,
          solutionMoveCount: 2,
          generated: 10,
        }),
        createResult({
          levelId: 'higher-generated',
          name: 'Higher Generated',
          elapsedMs: 5,
          solutionPushCount: 1,
          solutionMoveCount: 2,
          generated: 11,
        }),
      ],
      'elapsed',
    );

    expect(ranked.map((result) => result.levelId)).toEqual(['alpha', 'beta', 'higher-generated']);
  });

  it('includes error messages in the failure section when present', () => {
    const report = formatLevelDifficultyReport(
      [
        createResult({
          levelId: 'error-level',
          name: 'Error Level',
          status: 'error',
          withinTimeBudget: false,
          solutionMoveCount: null,
          solutionPushCount: null,
          errorMessage: 'Solver crashed',
        }),
      ],
      {
        algorithmId: 'bfsPush',
        nodeBudget: 500,
        sortBy: 'difficulty',
        timeBudgetMs: 100,
      },
    );

    expect(report).toContain('error-level | Error Level | error | elapsed');
    expect(report).toContain('Solver crashed');
  });
});

describe('levelDifficultyReport sort descriptions', () => {
  it.each([
    [
      'difficulty',
      'solved-first, then fewer pushes, fewer moves, lower search effort, then lower elapsed time',
    ],
    ['pushes', 'solved-first, then fewer pushes, then fewer moves'],
    ['moves', 'solved-first, then fewer moves, then fewer pushes'],
    ['generated', 'solved-first, then fewer generated states'],
    ['elapsed', 'solved-first, then lower elapsed time'],
  ] satisfies Array<[(typeof LEVEL_DIFFICULTY_SORTS)[number], string]>)(
    'describes %s sorting in the formatted report',
    (sortBy, description) => {
      const report = formatLevelDifficultyReport(
        [createResult({ levelId: 'demo', name: 'Demo' })],
        {
          algorithmId: 'bfsPush',
          nodeBudget: 1_000,
          sortBy,
          timeBudgetMs: 500,
        },
      );

      expect(report).toContain(`Suggested sort: ${sortBy} (${description}).`);
    },
  );
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

  it('rejects unimplemented algorithms before running the benchmark suite', async () => {
    await expect(
      benchmarkLevelDifficulty(
        [
          {
            id: 'single-push',
            name: 'Single Push',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
          },
        ],
        {
          algorithmId: 'dfsPush' as never,
          environment: {
            userAgent: 'vitest',
            hardwareConcurrency: 1,
            appVersion: 'test',
          },
        },
      ),
    ).rejects.toThrow('not implemented');
  });
});
