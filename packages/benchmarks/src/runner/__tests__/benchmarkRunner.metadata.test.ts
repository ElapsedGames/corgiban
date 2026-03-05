import { describe, expect, it } from 'vitest';

import type { BenchmarkRunExecutionRequest, BenchmarkSuite } from '../../model/benchmarkTypes';
import { buildComparableMetadata, runBenchmarkSuite } from '../benchmarkRunner';

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

describe('benchmarkRunner metadata', () => {
  it('buildComparableMetadata marks warmup-enabled runs and carries solver options', () => {
    const metadata = buildComparableMetadata(
      {
        suiteRunId: 'suite-direct',
        runId: 'suite-direct:1',
        sequence: 1,
        levelId: 'level-1',
        algorithmId: 'astarPush',
        repetition: 1,
        warmup: false,
        options: {
          heuristicId: 'manhattan',
          heuristicWeight: 1.5,
          timeBudgetMs: 2500,
          nodeBudget: 900,
          enableSpectatorStream: false,
        },
      },
      {
        suiteRunId: 'suite-direct',
        suite: {
          levelIds: ['level-1'],
          solverConfigs: [{ algorithmId: 'astarPush' }],
          repetitions: 1,
          warmupRepetitions: 3,
          timeBudgetMs: 2500,
          nodeBudget: 900,
        },
        environment: {
          userAgent: 'runner-test',
          hardwareConcurrency: 6,
          appVersion: 'test',
        },
      },
      3,
    );

    expect(metadata).toEqual({
      solver: {
        algorithmId: 'astarPush',
        heuristicId: 'manhattan',
        heuristicWeight: 1.5,
        timeBudgetMs: 2500,
        nodeBudget: 900,
        enableSpectatorStream: false,
      },
      environment: {
        userAgent: 'runner-test',
        hardwareConcurrency: 6,
        appVersion: 'test',
      },
      warmupEnabled: true,
      warmupRepetitions: 3,
    });
  });

  it('captures comparable solver metadata and environment snapshots', async () => {
    const suite: BenchmarkSuite = {
      levelIds: ['level-metadata'],
      solverConfigs: [
        {
          algorithmId: 'astarPush',
          options: {
            heuristicId: 'assignment',
            heuristicWeight: 2,
            enableSpectatorStream: true,
          },
        },
      ],
      repetitions: 1,
      warmupRepetitions: 2,
      timeBudgetMs: 3000,
      nodeBudget: 1500,
    };

    const environment = {
      userAgent: 'runner-test',
      hardwareConcurrency: 16,
      appVersion: '1.2.3',
    };

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-meta',
        suite,
        environment,
      },
      {
        execute: async () => ({
          status: 'solved',
          solutionMoves: 'RRLL',
          metrics: createMetrics(10),
        }),
        nowMs: createNowMs([10, 12, 20, 23, 30, 35]),
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.solutionMoves).toBe('RRLL');
    expect(results[0]?.environment).toEqual(environment);
    expect(results[0]?.options).toEqual({
      heuristicId: 'assignment',
      heuristicWeight: 2,
      enableSpectatorStream: true,
      timeBudgetMs: 3000,
      nodeBudget: 1500,
    });
    expect(results[0]?.comparableMetadata).toEqual({
      solver: {
        algorithmId: 'astarPush',
        heuristicId: 'assignment',
        heuristicWeight: 2,
        enableSpectatorStream: true,
        timeBudgetMs: 3000,
        nodeBudget: 1500,
      },
      environment,
      warmupEnabled: true,
      warmupRepetitions: 2,
    });
  });

  it('preserves error payload fields from solver outcomes', async () => {
    const suite: BenchmarkSuite = {
      levelIds: ['level-errors'],
      solverConfigs: [{ algorithmId: 'bfsPush' }],
      repetitions: 1,
      timeBudgetMs: 1000,
      nodeBudget: 500,
    };

    const execute = async (request: BenchmarkRunExecutionRequest) => {
      return {
        status: 'error' as const,
        metrics: createMetrics(request.repetition),
        errorMessage: 'Synthetic error',
        errorDetails: 'details',
      };
    };

    const results = await runBenchmarkSuite(
      {
        suiteRunId: 'suite-errors',
        suite,
        environment: {
          userAgent: 'runner-test',
          hardwareConcurrency: 4,
          appVersion: 'test',
        },
      },
      {
        execute,
        nowMs: createNowMs([1, 2]),
      },
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.errorMessage).toBe('Synthetic error');
    expect(results[0]?.errorDetails).toBe('details');
  });

  it('keeps comparable metadata minimal when optional solver fields are absent', () => {
    const metadata = buildComparableMetadata(
      {
        suiteRunId: 'suite-minimal',
        runId: 'suite-minimal:1',
        sequence: 1,
        levelId: 'level-1',
        algorithmId: 'bfsPush',
        repetition: 1,
        warmup: false,
        options: {},
      },
      {
        suiteRunId: 'suite-minimal',
        suite: {
          levelIds: ['level-1'],
          solverConfigs: [{ algorithmId: 'bfsPush' }],
          repetitions: 1,
          timeBudgetMs: 1000,
          nodeBudget: 500,
        },
        environment: {
          userAgent: 'runner-test',
          hardwareConcurrency: 4,
          appVersion: 'test',
        },
      },
      0,
    );

    expect(metadata).toEqual({
      solver: {
        algorithmId: 'bfsPush',
      },
      environment: {
        userAgent: 'runner-test',
        hardwareConcurrency: 4,
        appVersion: 'test',
      },
      warmupEnabled: false,
      warmupRepetitions: 0,
    });
  });
});
