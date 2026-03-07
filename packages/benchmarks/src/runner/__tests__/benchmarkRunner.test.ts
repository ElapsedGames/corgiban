import { describe, expect, it, vi } from 'vitest';

import type { BenchmarkRunExecutionRequest, BenchmarkSuite } from '../../model/benchmarkTypes';
import { buildBenchmarkRunPlans, runBenchmarkSuite } from '../benchmarkRunner';

function createNowMs(values: number[]) {
  let index = 0;
  return () => {
    const value = values[index];
    index += 1;
    return value ?? values[values.length - 1] ?? 0;
  };
}

function createMetrics(seed: number) {
  return {
    elapsedMs: seed,
    expanded: seed + 1,
    generated: seed + 2,
    maxDepth: seed + 3,
    maxFrontier: seed + 4,
    pushCount: seed + 5,
    moveCount: seed + 6,
  };
}

const suite: BenchmarkSuite = {
  levelIds: ['level-1'],
  solverConfigs: [
    {
      algorithmId: 'bfsPush',
      options: {
        heuristicId: 'manhattan',
      },
    },
  ],
  repetitions: 2,
  warmupRepetitions: 1,
  timeBudgetMs: 1500,
  nodeBudget: 600,
};

function createEnvironment() {
  return {
    userAgent: 'vitest',
    hardwareConcurrency: 8,
    appVersion: 'test',
  };
}

describe('benchmarkRunner', () => {
  it('builds deterministic plans with warmup iterations before measured runs', () => {
    const plans = buildBenchmarkRunPlans({
      suiteRunId: 'suite-1',
      suite,
    });

    expect(plans).toHaveLength(3);
    expect(
      plans.map((plan) => `${plan.levelId}:${plan.algorithmId}:${plan.warmup}:${plan.repetition}`),
    ).toEqual(['level-1:bfsPush:true:1', 'level-1:bfsPush:false:1', 'level-1:bfsPush:false:2']);
  });

  it('executes warmups, discards them, and reports measured progress deterministically', async () => {
    const execute = vi.fn(async (request: BenchmarkRunExecutionRequest) => {
      return {
        status: 'unsolved' as const,
        metrics: createMetrics(request.warmup ? 1 : request.repetition * 10),
      };
    });

    const onProgress = vi.fn();
    const onResult = vi.fn();

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-1',
        suite,
        environment: {
          userAgent: 'vitest',
          hardwareConcurrency: 8,
          appVersion: 'test',
        },
        onProgress,
        onResult,
      },
      {
        execute,
        nowMs: createNowMs([100, 110, 120, 135, 140, 158]),
      },
    );

    expect(execute).toHaveBeenCalledTimes(3);
    expect(execute.mock.calls.map(([request]) => request.warmup)).toEqual([true, false, false]);
    expect(execute.mock.calls.map(([request]) => request.options.timeBudgetMs)).toEqual([
      1500, 1500, 1500,
    ]);
    expect(execute.mock.calls.map(([request]) => request.options.nodeBudget)).toEqual([
      600, 600, 600,
    ]);

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.sequence)).toEqual([1, 2]);
    expect(results.map((result) => result.repetition)).toEqual([1, 2]);
    expect(results.map((result) => result.warmup)).toEqual([false, false]);

    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress.mock.calls[0]?.[0]).toEqual({
      suiteRunId: 'suite-1',
      totalRuns: 2,
      completedRuns: 1,
      latestResultId: 'suite-1:1',
    });
    expect(onProgress.mock.calls[1]?.[0]).toEqual({
      suiteRunId: 'suite-1',
      totalRuns: 2,
      completedRuns: 2,
      latestResultId: 'suite-1:2',
    });
  });

  it('runs level and solver configs in stable nested order', async () => {
    const orderedSuite: BenchmarkSuite = {
      levelIds: ['level-1', 'level-2'],
      solverConfigs: [{ algorithmId: 'bfsPush' }, { algorithmId: 'astarPush' }],
      repetitions: 1,
      timeBudgetMs: 2000,
      nodeBudget: 700,
    };

    const execute = vi.fn(async (_request: BenchmarkRunExecutionRequest) => ({
      status: 'unsolved' as const,
      metrics: createMetrics(1),
    }));

    await runBenchmarkSuite(
      {
        suiteRunId: 'suite-order',
        suite: orderedSuite,
        environment: {
          userAgent: 'vitest',
          hardwareConcurrency: 4,
          appVersion: 'test',
        },
      },
      {
        execute,
        nowMs: createNowMs([0, 1, 2, 3, 4, 5, 6, 7]),
      },
    );

    expect(
      execute.mock.calls.map(([request]) => `${request.levelId}:${request.algorithmId}`),
    ).toEqual(['level-1:bfsPush', 'level-1:astarPush', 'level-2:bfsPush', 'level-2:astarPush']);
  });

  it('uses custom run-id generation when provided', () => {
    const plans = buildBenchmarkRunPlans({
      suiteRunId: 'suite-custom',
      suite: {
        ...suite,
        repetitions: 1,
        warmupRepetitions: 0,
      },
      createRunId: (plan) => `custom:${plan.levelId}:${plan.algorithmId}:${plan.sequence}`,
    });

    expect(plans).toHaveLength(1);
    expect(plans[0]?.runId).toBe('custom:level-1:bfsPush:1');
  });

  it('generates deterministic default run ids and floors decimal repetition values', () => {
    const plans = buildBenchmarkRunPlans({
      suiteRunId: 'suite-default',
      suite: {
        ...suite,
        repetitions: 2.9,
        warmupRepetitions: 1.8,
      },
    });

    expect(plans.map((plan) => plan.runId)).toEqual([
      'suite-default:1:level-1:bfsPush:warmup',
      'suite-default:2:level-1:bfsPush:run1',
      'suite-default:3:level-1:bfsPush:run2',
    ]);
  });

  it('throws for invalid suite inputs in buildBenchmarkRunPlans', () => {
    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-missing-levels',
        suite: {
          ...suite,
          levelIds: [],
        },
      }),
    ).toThrow('at least one level id');

    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-too-many-levels',
        suite: {
          ...suite,
          levelIds: Array.from({ length: 201 }, (_, index) => `level-${index}`),
        },
      }),
    ).toThrow('MAX_BENCH_SUITE_LEVELS');

    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-no-solvers',
        suite: {
          ...suite,
          solverConfigs: [],
        },
      }),
    ).toThrow('at least one solver configuration');

    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-invalid-repetitions',
        suite: {
          ...suite,
          repetitions: 0,
        },
      }),
    ).toThrow('Benchmark repetitions must be a positive number.');

    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-invalid-warmup',
        suite: {
          ...suite,
          warmupRepetitions: -1,
        },
      }),
    ).toThrow('Benchmark warmup repetitions must be zero or a positive number.');

    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-invalid-time-budget',
        suite: {
          ...suite,
          timeBudgetMs: 0,
        },
      }),
    ).toThrow('Benchmark time budget must be a positive number.');

    expect(() =>
      buildBenchmarkRunPlans({
        suiteRunId: 'suite-invalid-node-budget',
        suite: {
          ...suite,
          nodeBudget: -5,
        },
      }),
    ).toThrow('Benchmark node budget must be a positive number.');
  });

  it('rejects invalid runBenchmarkSuite inputs before execution', async () => {
    const invalidSuites: Array<{ name: string; suite: BenchmarkSuite; expected: string }> = [
      {
        name: 'empty levelIds',
        suite: {
          ...suite,
          levelIds: [],
        },
        expected: 'at least one level id',
      },
      {
        name: 'too many levelIds',
        suite: {
          ...suite,
          levelIds: Array.from({ length: 201 }, (_, index) => `level-${index}`),
        },
        expected: 'MAX_BENCH_SUITE_LEVELS',
      },
      {
        name: 'empty solverConfigs',
        suite: {
          ...suite,
          solverConfigs: [],
        },
        expected: 'at least one solver configuration',
      },
      {
        name: 'repetitions = 0',
        suite: {
          ...suite,
          repetitions: 0,
        },
        expected: 'Benchmark repetitions must be a positive number.',
      },
      {
        name: 'repetitions = NaN',
        suite: {
          ...suite,
          repetitions: Number.NaN,
        },
        expected: 'Benchmark repetitions must be a positive number.',
      },
      {
        name: 'repetitions is negative',
        suite: {
          ...suite,
          repetitions: -3,
        },
        expected: 'Benchmark repetitions must be a positive number.',
      },
      {
        name: 'warmupRepetitions is negative',
        suite: {
          ...suite,
          warmupRepetitions: -1,
        },
        expected: 'Benchmark warmup repetitions must be zero or a positive number.',
      },
    ];

    for (const { name, suite: invalidSuite, expected } of invalidSuites) {
      const execute = vi.fn(async () => ({
        status: 'unsolved' as const,
        metrics: createMetrics(1),
      }));

      await expect(
        runBenchmarkSuite(
          {
            suiteRunId: `suite-invalid:${name}`,
            suite: invalidSuite,
            environment: createEnvironment(),
          },
          {
            execute,
          },
        ),
      ).rejects.toThrow(expected);

      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('skips warmup execution entirely when warmupRepetitions is zero', async () => {
    const execute = vi.fn(async (request: BenchmarkRunExecutionRequest) => ({
      status: 'unsolved' as const,
      metrics: createMetrics(request.repetition),
    }));

    const noWarmupSuite: BenchmarkSuite = {
      levelIds: ['level-1', 'level-2'],
      solverConfigs: [{ algorithmId: 'bfsPush' }],
      repetitions: 2,
      warmupRepetitions: 0,
      timeBudgetMs: 1500,
      nodeBudget: 600,
    };

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-no-warmup',
        suite: noWarmupSuite,
        environment: createEnvironment(),
      },
      {
        execute,
        nowMs: createNowMs([0, 1, 2, 3, 4, 5, 6, 7]),
      },
    );

    expect(execute).toHaveBeenCalledTimes(4);
    expect(execute.mock.calls.map(([request]) => request.warmup)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(results).toHaveLength(4);
    expect(results.map((result) => result.warmup)).toEqual([false, false, false, false]);
    expect(results.map((result) => `${result.levelId}:${result.repetition}`)).toEqual([
      'level-1:1',
      'level-1:2',
      'level-2:1',
      'level-2:2',
    ]);
  });

  it('uses Date.now when nowMs is omitted and preserves ordered timestamps', async () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(125);

    const execute = vi.fn(async () => ({
      status: 'unsolved' as const,
      metrics: createMetrics(7),
    }));

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-date-now',
        suite: {
          ...suite,
          repetitions: 1,
          warmupRepetitions: 0,
        },
        environment: createEnvironment(),
      },
      {
        execute,
      },
    );

    expect(dateNowSpy).toHaveBeenCalledTimes(2);
    expect(results[0]?.startedAtMs).toBe(100);
    expect(results[0]?.finishedAtMs).toBe(125);
    dateNowSpy.mockRestore();
  });

  it('clamps finishedAtMs when the wall clock rolls backwards during a run', async () => {
    const execute = vi.fn(async () => ({
      status: 'unsolved' as const,
      metrics: createMetrics(9),
    }));

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-clock-rollback',
        suite: {
          ...suite,
          repetitions: 1,
          warmupRepetitions: 0,
        },
        environment: createEnvironment(),
      },
      {
        execute,
        nowMs: createNowMs([200, 150]),
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.startedAtMs).toBe(200);
    expect(results[0]?.finishedAtMs).toBe(200);
  });

  it('omits solutionMoves and errorDetails when they are not present', async () => {
    const execute = vi.fn(async () => ({
      status: 'error' as const,
      errorMessage: 'failure',
      metrics: createMetrics(3),
    }));

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-error-shape',
        suite: {
          ...suite,
          repetitions: 1,
          warmupRepetitions: 0,
        },
        environment: createEnvironment(),
      },
      {
        execute,
        nowMs: createNowMs([10, 12]),
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.errorMessage).toBe('failure');
    expect('errorDetails' in (results[0] ?? {})).toBe(false);
    expect('solutionMoves' in (results[0] ?? {})).toBe(false);
  });
});
