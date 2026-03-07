import { MAX_BENCH_SUITE_LEVELS } from '@corgiban/shared';

import type {
  BenchmarkComparableMetadata,
  BenchmarkRunExecutionRequest,
  BenchmarkRunPlan,
  BenchmarkRunRecord,
  BenchmarkRunnerExecute,
  BenchmarkSuite,
  BenchmarkSuiteRunRequest,
} from '../model/benchmarkTypes';

export type BuildBenchmarkRunPlansRequest = {
  suiteRunId: string;
  suite: BenchmarkSuite;
  createRunId?: CreateBenchmarkRunId;
};

export type BenchmarkRunnerOptions = {
  execute: BenchmarkRunnerExecute;
  nowMs?: () => number;
  createRunId?: CreateBenchmarkRunId;
};

export type CreateBenchmarkRunId = (plan: Omit<BenchmarkRunPlan, 'runId'>) => string;

function toPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number.`);
  }

  return Math.floor(value);
}

function toNonNegativeInteger(value: number | undefined, fallback: number, label: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be zero or a positive number.`);
  }

  return Math.floor(value);
}

function validateSuite(suite: BenchmarkSuite): {
  repetitions: number;
  warmupRepetitions: number;
} {
  if (suite.levelIds.length === 0) {
    throw new Error('Benchmark suite must include at least one level id.');
  }

  if (suite.levelIds.length > MAX_BENCH_SUITE_LEVELS) {
    throw new Error(`Benchmark suite exceeds MAX_BENCH_SUITE_LEVELS (${MAX_BENCH_SUITE_LEVELS}).`);
  }

  if (suite.solverConfigs.length === 0) {
    throw new Error('Benchmark suite must include at least one solver configuration.');
  }

  const repetitions = toPositiveInteger(suite.repetitions, 'Benchmark repetitions');
  const warmupRepetitions = toNonNegativeInteger(
    suite.warmupRepetitions,
    0,
    'Benchmark warmup repetitions',
  );

  toPositiveInteger(suite.timeBudgetMs, 'Benchmark time budget');
  toPositiveInteger(suite.nodeBudget, 'Benchmark node budget');

  return {
    repetitions,
    warmupRepetitions,
  };
}

function defaultRunId(plan: Omit<BenchmarkRunPlan, 'runId'>): string {
  const phase = plan.warmup ? 'warmup' : `run${plan.repetition}`;
  return `${plan.suiteRunId}:${plan.sequence}:${plan.levelId}:${plan.algorithmId}:${phase}`;
}

function buildRunOptions(suite: BenchmarkSuite, options: BenchmarkRunPlan['options']) {
  return {
    ...options,
    timeBudgetMs: suite.timeBudgetMs,
    nodeBudget: suite.nodeBudget,
  };
}

function buildSolverMetadata(plan: BenchmarkRunPlan): BenchmarkComparableMetadata['solver'] {
  return {
    algorithmId: plan.algorithmId,
    ...(plan.options.heuristicId !== undefined ? { heuristicId: plan.options.heuristicId } : {}),
    ...(plan.options.heuristicWeight !== undefined
      ? { heuristicWeight: plan.options.heuristicWeight }
      : {}),
    ...(plan.options.timeBudgetMs !== undefined ? { timeBudgetMs: plan.options.timeBudgetMs } : {}),
    ...(plan.options.nodeBudget !== undefined ? { nodeBudget: plan.options.nodeBudget } : {}),
    ...(plan.options.enableSpectatorStream !== undefined
      ? { enableSpectatorStream: plan.options.enableSpectatorStream }
      : {}),
  };
}

function clampFinishedAtMs(startedAtMs: number, finishedAtMs: number): number {
  return finishedAtMs >= startedAtMs ? finishedAtMs : startedAtMs;
}

export function buildComparableMetadata(
  plan: BenchmarkRunPlan,
  request: BenchmarkSuiteRunRequest,
  warmupRepetitions: number,
): BenchmarkComparableMetadata {
  return {
    solver: buildSolverMetadata(plan),
    environment: request.environment,
    warmupEnabled: warmupRepetitions > 0,
    warmupRepetitions,
  };
}

export function buildBenchmarkRunPlans(request: BuildBenchmarkRunPlansRequest): BenchmarkRunPlan[] {
  const { repetitions, warmupRepetitions } = validateSuite(request.suite);
  const createRunId = request.createRunId ?? defaultRunId;

  const plans: BenchmarkRunPlan[] = [];
  let sequence = 0;

  request.suite.levelIds.forEach((levelId) => {
    request.suite.solverConfigs.forEach((solverConfig) => {
      const options = buildRunOptions(request.suite, solverConfig.options ?? {});

      for (let repetition = 1; repetition <= warmupRepetitions; repetition += 1) {
        sequence += 1;
        const draft = {
          suiteRunId: request.suiteRunId,
          sequence,
          levelId,
          algorithmId: solverConfig.algorithmId,
          options,
          repetition,
          warmup: true,
        } as const;

        plans.push({
          ...draft,
          runId: createRunId(draft),
        });
      }

      for (let repetition = 1; repetition <= repetitions; repetition += 1) {
        sequence += 1;
        const draft = {
          suiteRunId: request.suiteRunId,
          sequence,
          levelId,
          algorithmId: solverConfig.algorithmId,
          options,
          repetition,
          warmup: false,
        } as const;

        plans.push({
          ...draft,
          runId: createRunId(draft),
        });
      }
    });
  });

  return plans;
}

function toBenchmarkRunRecord(params: {
  request: BenchmarkSuiteRunRequest;
  plan: BenchmarkRunPlan;
  resultSequence: number;
  warmupRepetitions: number;
  startedAtMs: number;
  finishedAtMs: number;
  outcome: Awaited<ReturnType<BenchmarkRunnerExecute>>;
}): BenchmarkRunRecord {
  const { request, plan, resultSequence, warmupRepetitions, startedAtMs, finishedAtMs, outcome } =
    params;

  const record: BenchmarkRunRecord = {
    id: `${request.suiteRunId}:${resultSequence}`,
    suiteRunId: request.suiteRunId,
    runId: plan.runId,
    sequence: resultSequence,
    levelId: plan.levelId,
    algorithmId: plan.algorithmId,
    repetition: plan.repetition,
    warmup: false,
    options: plan.options,
    status: outcome.status,
    metrics: outcome.metrics,
    startedAtMs,
    finishedAtMs,
    environment: request.environment,
    comparableMetadata: buildComparableMetadata(plan, request, warmupRepetitions),
  };

  if ('solutionMoves' in outcome && outcome.solutionMoves !== undefined) {
    record.solutionMoves = outcome.solutionMoves;
  }

  if (outcome.status === 'error') {
    record.errorMessage = outcome.errorMessage;
    if (outcome.errorDetails !== undefined) {
      record.errorDetails = outcome.errorDetails;
    }
  }

  return record;
}

export async function runBenchmarkSuite(
  request: BenchmarkSuiteRunRequest,
  options: BenchmarkRunnerOptions,
): Promise<BenchmarkRunRecord[]> {
  const { repetitions, warmupRepetitions } = validateSuite(request.suite);
  const nowMs = options.nowMs ?? Date.now;

  const plans = buildBenchmarkRunPlans({
    suiteRunId: request.suiteRunId,
    suite: request.suite,
    createRunId: options.createRunId,
  });

  const totalRuns =
    request.suite.levelIds.length * request.suite.solverConfigs.length * repetitions;

  const results: BenchmarkRunRecord[] = [];
  let completedRuns = 0;

  for (const plan of plans) {
    const executionRequest: BenchmarkRunExecutionRequest = {
      suiteRunId: plan.suiteRunId,
      runId: plan.runId,
      levelId: plan.levelId,
      algorithmId: plan.algorithmId,
      options: plan.options,
      repetition: plan.repetition,
      warmup: plan.warmup,
    };

    const startedAtMs = nowMs();
    const outcome = await options.execute(executionRequest);
    const finishedAtMs = clampFinishedAtMs(startedAtMs, nowMs());

    if (plan.warmup) {
      continue;
    }

    completedRuns += 1;
    const record = toBenchmarkRunRecord({
      request,
      plan,
      resultSequence: completedRuns,
      warmupRepetitions,
      startedAtMs,
      finishedAtMs,
      outcome,
    });

    results.push(record);
    request.onResult?.(record);
    request.onProgress?.({
      suiteRunId: request.suiteRunId,
      totalRuns,
      completedRuns,
      latestResultId: record.id,
    });
  }

  return results;
}
