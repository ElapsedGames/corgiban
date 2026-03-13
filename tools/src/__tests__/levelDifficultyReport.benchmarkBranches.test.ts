import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LevelDefinition } from '@corgiban/levels';

const mocks = vi.hoisted(() => ({
  analyzeLevel: vi.fn(),
  isImplementedAlgorithmId: vi.fn(),
  parseLevel: vi.fn(),
  runBenchmarkSuite: vi.fn(),
  solve: vi.fn(),
}));

vi.mock('@corgiban/benchmarks', () => ({
  runBenchmarkSuite: mocks.runBenchmarkSuite,
}));

vi.mock('@corgiban/core', () => ({
  parseLevel: mocks.parseLevel,
}));

vi.mock('@corgiban/solver', () => ({
  DEFAULT_ALGORITHM_ID: 'astarPush',
  DEFAULT_NODE_BUDGET: 2_000_000,
  analyzeLevel: mocks.analyzeLevel,
  isImplementedAlgorithmId: mocks.isImplementedAlgorithmId,
  solve: mocks.solve,
}));

import { benchmarkLevelDifficulty } from '../levelDifficultyReport';

const environment = {
  appVersion: 'test',
  hardwareConcurrency: 4,
  userAgent: 'vitest',
};

function createLevels(): LevelDefinition[] {
  return [
    {
      id: 'alpha',
      name: 'Alpha',
      rows: ['P'],
    },
    {
      id: 'beta',
      name: 'Beta',
      rows: ['P'],
    },
  ];
}

describe('benchmarkLevelDifficulty benchmark branches', () => {
  beforeEach(() => {
    mocks.analyzeLevel.mockReset();
    mocks.isImplementedAlgorithmId.mockReset();
    mocks.parseLevel.mockReset();
    mocks.runBenchmarkSuite.mockReset();
    mocks.solve.mockReset();

    mocks.isImplementedAlgorithmId.mockReturnValue(true);
    mocks.parseLevel.mockImplementation((level: LevelDefinition) => ({ runtimeId: level.id }));
    mocks.analyzeLevel.mockImplementation((runtime: { runtimeId: string }) => ({
      boxCount: runtime.runtimeId.length,
      reachableCount: runtime.runtimeId.length + 2,
      walkableCount: runtime.runtimeId.length + 4,
    }));
    mocks.solve.mockReturnValue({
      status: 'solved',
      solutionMoves: 'R',
      metrics: {
        elapsedMs: 5,
        expanded: 2,
        generated: 3,
        maxDepth: 1,
        maxFrontier: 2,
        pushCount: 1,
        moveCount: 1,
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects algorithms that are not implemented', async () => {
    mocks.isImplementedAlgorithmId.mockReturnValue(false);

    await expect(
      benchmarkLevelDifficulty(createLevels(), {
        algorithmId: 'greedyPush',
        environment,
      }),
    ).rejects.toThrow('Algorithm "greedyPush" is not implemented in this repo yet.');
  });

  it('uses the default suite configuration when optional inputs are omitted', async () => {
    mocks.runBenchmarkSuite.mockResolvedValue([]);

    await benchmarkLevelDifficulty(createLevels(), {
      environment,
    });

    expect(mocks.runBenchmarkSuite).toHaveBeenCalledWith(
      expect.objectContaining({
        environment,
        suite: expect.objectContaining({
          levelIds: ['alpha', 'beta'],
          nodeBudget: 2_000_000,
          repetitions: 1,
          solverConfigs: [{ algorithmId: 'astarPush' }],
          timeBudgetMs: 15_000,
          warmupRepetitions: 0,
        }),
        suiteRunId: 'level-difficulty',
      }),
      expect.any(Object),
    );
  });

  it('honors maxLevels and explicit suite configuration overrides', async () => {
    mocks.runBenchmarkSuite.mockResolvedValue([]);

    await benchmarkLevelDifficulty(createLevels(), {
      algorithmId: 'bfsPush',
      environment,
      maxLevels: 1,
      nodeBudget: 99,
      suiteRunId: 'suite-42',
      timeBudgetMs: 77,
    });

    expect(mocks.runBenchmarkSuite).toHaveBeenCalledWith(
      expect.objectContaining({
        suite: expect.objectContaining({
          levelIds: ['alpha'],
          nodeBudget: 99,
          solverConfigs: [{ algorithmId: 'bfsPush' }],
          timeBudgetMs: 77,
        }),
        suiteRunId: 'suite-42',
      }),
      expect.any(Object),
    );
  });

  it('executes solve requests against the parsed runtime with a performance-backed clock', async () => {
    mocks.runBenchmarkSuite.mockImplementation(async (_request, helpers) => {
      const result = helpers.execute({
        algorithmId: 'bfsPush',
        levelId: 'alpha',
        options: { nodeBudget: 33 },
      });

      expect(result).toMatchObject({ status: 'solved' });
      expect(mocks.solve).toHaveBeenCalledWith(
        { runtimeId: 'alpha' },
        'bfsPush',
        { nodeBudget: 33 },
        undefined,
        expect.objectContaining({
          nowMs: expect.any(Function),
        }),
      );
      expect(typeof mocks.solve.mock.calls[0]?.[4]?.nowMs()).toBe('number');

      return [
        {
          levelId: 'alpha',
          metrics: {
            elapsedMs: 9,
            expanded: 4,
            generated: 6,
            maxDepth: 2,
            maxFrontier: 3,
            moveCount: 2,
            pushCount: 1,
          },
          status: 'solved',
        },
      ];
    });

    const [result] = await benchmarkLevelDifficulty(createLevels(), {
      algorithmId: 'bfsPush',
      environment,
      timeBudgetMs: 10,
    });

    expect(result).toMatchObject({
      boxCount: 5,
      levelId: 'alpha',
      reachableCount: 7,
      solutionMoveCount: 2,
      solutionPushCount: 1,
      withinTimeBudget: true,
    });
  });

  it('throws when the benchmark suite requests a level id outside the selected set', async () => {
    mocks.runBenchmarkSuite.mockImplementation(async (_request, helpers) => {
      expect(() =>
        helpers.execute({
          algorithmId: 'bfsPush',
          levelId: 'missing',
          options: {},
        }),
      ).toThrow('Unknown level id "missing" in difficulty benchmark.');
      return [];
    });

    await benchmarkLevelDifficulty(createLevels(), {
      environment,
      maxLevels: 1,
    });
  });

  it('maps solved and failed benchmark records into level difficulty results', async () => {
    mocks.runBenchmarkSuite.mockResolvedValue([
      {
        levelId: 'alpha',
        metrics: {
          elapsedMs: 12,
          expanded: 4,
          generated: 6,
          maxDepth: 2,
          maxFrontier: 3,
          moveCount: 2,
          pushCount: 1,
        },
        status: 'solved',
      },
      {
        errorDetails: 'worker reset',
        errorMessage: 'solver crashed',
        levelId: 'beta',
        metrics: {
          elapsedMs: 30,
          expanded: 7,
          generated: 9,
          maxDepth: 3,
          maxFrontier: 4,
          moveCount: 0,
          pushCount: 0,
        },
        status: 'error',
      },
    ]);

    const results = await benchmarkLevelDifficulty(createLevels(), {
      environment,
      timeBudgetMs: 10,
    });

    expect(results).toEqual([
      expect.objectContaining({
        boxCount: 5,
        levelId: 'alpha',
        solutionMoveCount: 2,
        solutionPushCount: 1,
        withinTimeBudget: false,
      }),
      expect.objectContaining({
        errorDetails: 'worker reset',
        errorMessage: 'solver crashed',
        levelId: 'beta',
        solutionMoveCount: null,
        solutionPushCount: null,
        status: 'error',
        withinTimeBudget: false,
      }),
    ]);
  });

  it('throws when a returned benchmark record references an unknown level id', async () => {
    mocks.runBenchmarkSuite.mockResolvedValue([
      {
        levelId: 'missing',
        metrics: {
          elapsedMs: 5,
          expanded: 1,
          generated: 1,
          maxDepth: 1,
          maxFrontier: 1,
          moveCount: 0,
          pushCount: 0,
        },
        status: 'timeout',
      },
    ]);

    await expect(
      benchmarkLevelDifficulty(createLevels(), {
        environment,
      }),
    ).rejects.toThrow('Unknown benchmark result level id "missing".');
  });
});
