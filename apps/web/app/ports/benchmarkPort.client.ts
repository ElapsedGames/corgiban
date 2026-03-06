import type { BenchmarkClient, BenchmarkClientRunRequest } from '@corgiban/worker';
import { createBenchmarkClient } from '@corgiban/worker';
import {
  buildBenchmarkRunPlans,
  type BenchmarkRunPlan,
  type BenchmarkSuite,
} from '@corgiban/benchmarks';

import benchmarkWorkerUrl from './benchmarkWorker.client.ts?worker&url';
import {
  BenchmarkRunCancelledError,
  type BenchmarkPort,
  type BenchmarkWorkerProgress,
  type BenchmarkRunRecord,
  type BenchmarkSuiteConfig,
} from './benchmarkPort';

const DEFAULT_HARDWARE_CONCURRENCY = 4;
const MIN_POOL_SIZE = 1;
const MAX_POOL_SIZE = 4;

export type BenchmarkPortPerformanceApi = Pick<Performance, 'mark' | 'measure'>;

type BenchmarkPortNavigator = Pick<Navigator, 'hardwareConcurrency' | 'userAgent'>;

type CreateBenchmarkPortOptions = {
  concurrency?: number;
  performanceApi?: BenchmarkPortPerformanceApi;
  navigatorLike?: BenchmarkPortNavigator;
  createBenchmarkClientImpl?: typeof createBenchmarkClient;
  now?: () => number;
  appVersion?: string;
};

type RunPlan = BenchmarkRunPlan;

type ActiveSuite = {
  suiteRunId: string;
  cancelled: boolean;
  client: BenchmarkClient;
};

type BenchmarkEnvironmentSnapshot = {
  userAgent: string;
  hardwareConcurrency: number;
  appVersion: string;
};

function resolveDefaultAppVersion(): string {
  const injectedBuildId = import.meta.env?.VITE_APP_BUILD_ID;
  if (typeof injectedBuildId === 'string' && injectedBuildId.trim().length > 0) {
    return injectedBuildId.trim();
  }

  const mode = import.meta.env?.MODE;
  if (typeof mode === 'string' && mode.trim().length > 0) {
    return `mode:${mode.trim()}`;
  }

  return 'unknown-build';
}

const DEFAULT_APP_VERSION = resolveDefaultAppVersion();

function createBenchmarkWorker() {
  if (benchmarkWorkerUrl.length === 0) {
    throw new Error('Benchmark worker URL resolved to an empty string.');
  }

  return new Worker(benchmarkWorkerUrl, { type: 'module', name: 'corgiban-benchmark' });
}

export function resolveBenchmarkConcurrency(navigatorLike?: BenchmarkPortNavigator): number {
  const cores =
    typeof navigatorLike?.hardwareConcurrency === 'number' && navigatorLike.hardwareConcurrency > 0
      ? navigatorLike.hardwareConcurrency
      : DEFAULT_HARDWARE_CONCURRENCY;

  return Math.max(MIN_POOL_SIZE, Math.min(MAX_POOL_SIZE, cores - 1));
}

function buildRunPlans(suiteRunId: string, suite: BenchmarkSuiteConfig): RunPlan[] {
  if (suite.levelIds.length === 0 || suite.algorithmIds.length === 0) {
    return [];
  }

  const benchmarkSuite: BenchmarkSuite = {
    levelIds: suite.levelIds,
    solverConfigs: suite.algorithmIds.map((algorithmId) => ({
      algorithmId,
      options: suite.algorithmOptions?.[algorithmId],
    })),
    repetitions: suite.repetitions,
    warmupRepetitions: suite.warmupRepetitions,
    timeBudgetMs: suite.timeBudgetMs,
    nodeBudget: suite.nodeBudget,
  };

  return buildBenchmarkRunPlans({
    suiteRunId,
    suite: benchmarkSuite,
    createRunId: (plan) => `${plan.suiteRunId}-${plan.sequence}`,
  });
}

function buildMeasuredSequenceByRunId(plans: RunPlan[]): Map<string, number> {
  const measuredSequenceByRunId = new Map<string, number>();
  let measuredSequence = 0;

  plans.forEach((plan) => {
    if (plan.warmup) {
      return;
    }

    measuredSequence += 1;
    measuredSequenceByRunId.set(plan.runId, measuredSequence);
  });

  return measuredSequenceByRunId;
}

function toRunRequestOptions(options: RunPlan['options'], streamWorkerProgress: boolean) {
  if (streamWorkerProgress || options?.enableSpectatorStream !== true) {
    return options;
  }

  return {
    ...options,
    enableSpectatorStream: false,
  };
}

function toWorkerProgress(
  suiteRunId: string,
  plan: RunPlan,
  measuredSequence: number | null,
  progress: {
    expanded: number;
    generated: number;
    depth: number;
    frontier: number;
    elapsedMs: number;
    bestHeuristic?: number;
    bestPathSoFar?: string;
  },
): BenchmarkWorkerProgress {
  return {
    suiteRunId,
    runId: plan.runId,
    planSequence: plan.sequence,
    measuredSequence,
    warmup: plan.warmup,
    levelId: plan.levelId,
    algorithmId: plan.algorithmId,
    repetition: plan.repetition,
    expanded: progress.expanded,
    generated: progress.generated,
    depth: progress.depth,
    frontier: progress.frontier,
    elapsedMs: progress.elapsedMs,
    ...(progress.bestHeuristic !== undefined ? { bestHeuristic: progress.bestHeuristic } : {}),
    ...(progress.bestPathSoFar !== undefined ? { bestPathSoFar: progress.bestPathSoFar } : {}),
  };
}

function markSolveDispatch(performanceApi: BenchmarkPortPerformanceApi | undefined, runId: string) {
  if (!performanceApi) {
    return;
  }

  try {
    performanceApi.mark(`bench:solve-dispatch:${runId}`);
  } catch {
    // Performance instrumentation is best-effort and must not fail runs.
  }
}

function markSolveResponse(performanceApi: BenchmarkPortPerformanceApi | undefined, runId: string) {
  if (!performanceApi) {
    return;
  }

  const dispatchMark = `bench:solve-dispatch:${runId}`;
  const responseMark = `bench:solve-response:${runId}`;

  try {
    performanceApi.mark(responseMark);
    performanceApi.measure(`bench:solve-roundtrip:${runId}`, dispatchMark, responseMark);
  } catch {
    // Performance instrumentation is best-effort and must not fail runs.
  }
}

function createEnvironmentSnapshot(
  navigatorLike: BenchmarkPortNavigator | undefined,
  appVersion: string,
): BenchmarkEnvironmentSnapshot {
  const hardwareConcurrency =
    typeof navigatorLike?.hardwareConcurrency === 'number' && navigatorLike.hardwareConcurrency > 0
      ? navigatorLike.hardwareConcurrency
      : DEFAULT_HARDWARE_CONCURRENCY;

  return {
    userAgent: navigatorLike?.userAgent ?? 'unknown',
    hardwareConcurrency,
    appVersion,
  };
}

function buildComparableMetadata(
  plan: RunPlan,
  options: RunPlan['options'],
  environment: BenchmarkEnvironmentSnapshot,
  warmupRepetitions: number,
) {
  return {
    solver: {
      algorithmId: plan.algorithmId,
      ...(options.heuristicId !== undefined ? { heuristicId: options.heuristicId } : {}),
      ...(options.heuristicWeight !== undefined
        ? { heuristicWeight: options.heuristicWeight }
        : {}),
      ...(options.timeBudgetMs !== undefined ? { timeBudgetMs: options.timeBudgetMs } : {}),
      ...(options.nodeBudget !== undefined ? { nodeBudget: options.nodeBudget } : {}),
      ...(options.enableSpectatorStream !== undefined
        ? { enableSpectatorStream: options.enableSpectatorStream }
        : {}),
    },
    environment,
    warmupEnabled: warmupRepetitions > 0,
    warmupRepetitions,
  };
}

export function createBenchmarkPort(options: CreateBenchmarkPortOptions = {}): BenchmarkPort {
  const navigatorLike = options.navigatorLike ?? globalThis.navigator;
  const now = options.now ?? Date.now;
  const performanceApi = options.performanceApi ?? globalThis.performance;
  const appVersion = options.appVersion ?? DEFAULT_APP_VERSION;
  const createBenchmarkClientImpl = options.createBenchmarkClientImpl ?? createBenchmarkClient;

  let activeSuite: ActiveSuite | null = null;

  const createClient = () => {
    // Manual override respects MAX_POOL_SIZE cap just like the auto-computed path.
    const poolSize =
      options.concurrency && options.concurrency > 0
        ? Math.max(MIN_POOL_SIZE, Math.min(MAX_POOL_SIZE, Math.floor(options.concurrency)))
        : resolveBenchmarkConcurrency(navigatorLike);

    return createBenchmarkClientImpl({ createWorker: createBenchmarkWorker, poolSize });
  };

  const clearActiveSuite = (suiteRunId: string) => {
    if (activeSuite?.suiteRunId !== suiteRunId) {
      return;
    }
    activeSuite = null;
  };

  return {
    async runSuite(request) {
      if (activeSuite && !activeSuite.cancelled) {
        throw new Error('A benchmark suite is already running.');
      }

      const client = createClient();
      const suiteRef: ActiveSuite = {
        suiteRunId: request.suiteRunId,
        cancelled: false,
        client,
      };
      activeSuite = suiteRef;

      try {
        const plans = buildRunPlans(request.suiteRunId, request.suite);
        const warmupRepetitions = Math.max(0, Math.floor(request.suite.warmupRepetitions ?? 0));
        const totalRuns = plans.filter((plan) => !plan.warmup).length;

        if (totalRuns === 0) {
          return [];
        }

        const environment = createEnvironmentSnapshot(navigatorLike, appVersion);
        const planMetas = new Map(plans.map((p) => [p.runId, p]));
        const measuredSequenceByRunId = buildMeasuredSequenceByRunId(plans);
        const streamWorkerProgress = typeof request.onWorkerProgress === 'function';
        const runStartTimes = new Map<string, number>();
        const dispatchMarked = new Set<string>();
        const resultsBySequence = new Map<number, BenchmarkRunRecord>();
        let completedRuns = 0;

        const runRequests: BenchmarkClientRunRequest[] = plans.map((plan) => ({
          runId: plan.runId,
          levelRuntime: request.levelResolver(plan.levelId),
          algorithmId: plan.algorithmId,
          options: toRunRequestOptions(plan.options, streamWorkerProgress),
        }));

        await client.runSuite({
          runs: runRequests,
          callbacks: {
            onDispatch(runRequest) {
              if (!dispatchMarked.has(runRequest.runId)) {
                runStartTimes.set(runRequest.runId, now());
                dispatchMarked.add(runRequest.runId);
                markSolveDispatch(performanceApi, runRequest.runId);
              }
            },
            onResult(resultMsg, runRequest) {
              if (suiteRef.cancelled) {
                return;
              }

              const finishedAtMs = now();
              let startedAtMs = runStartTimes.get(runRequest.runId);
              const plan = planMetas.get(runRequest.runId);
              if (!plan) {
                return;
              }

              // Defensive fallback for unexpected paths where dispatch callback was not observed.
              if (startedAtMs === undefined) {
                startedAtMs = finishedAtMs;
                runStartTimes.set(runRequest.runId, startedAtMs);
              }
              if (!dispatchMarked.has(runRequest.runId)) {
                markSolveDispatch(performanceApi, runRequest.runId);
                dispatchMarked.add(runRequest.runId);
              }
              markSolveResponse(performanceApi, runRequest.runId);
              if (plan.warmup) {
                return;
              }

              const resultSequence = measuredSequenceByRunId.get(runRequest.runId);
              if (!resultSequence) {
                return;
              }
              const recordOptions = runRequest.options ?? plan.options;

              const baseRecord = {
                id: `${request.suiteRunId}:${resultSequence}`,
                suiteRunId: request.suiteRunId,
                runId: runRequest.runId,
                sequence: resultSequence,
                levelId: plan.levelId,
                algorithmId: plan.algorithmId,
                repetition: plan.repetition,
                warmup: false,
                options: recordOptions,
                status: resultMsg.status,
                metrics: resultMsg.metrics,
                startedAtMs,
                finishedAtMs,
                environment,
                comparableMetadata: buildComparableMetadata(
                  plan,
                  recordOptions,
                  environment,
                  warmupRepetitions,
                ),
              };

              const record: BenchmarkRunRecord =
                resultMsg.status === 'error'
                  ? {
                      ...baseRecord,
                      errorMessage: resultMsg.errorMessage,
                      ...(resultMsg.errorDetails !== undefined
                        ? { errorDetails: resultMsg.errorDetails }
                        : {}),
                    }
                  : {
                      ...baseRecord,
                      ...(resultMsg.solutionMoves !== undefined
                        ? { solutionMoves: resultMsg.solutionMoves }
                        : {}),
                    };

              resultsBySequence.set(resultSequence, record);
              completedRuns += 1;

              request.onResult?.(record);
              request.onProgress?.({
                suiteRunId: request.suiteRunId,
                totalRuns,
                completedRuns,
                latestResultId: record.id,
              });
            },
            onProgress(progressMsg, runRequest) {
              if (suiteRef.cancelled || !streamWorkerProgress) {
                return;
              }

              const plan = planMetas.get(runRequest.runId);
              if (!plan) {
                return;
              }

              request.onWorkerProgress?.(
                toWorkerProgress(
                  request.suiteRunId,
                  plan,
                  measuredSequenceByRunId.get(runRequest.runId) ?? null,
                  progressMsg,
                ),
              );
            },
          },
        });

        if (suiteRef.cancelled) {
          throw new BenchmarkRunCancelledError();
        }

        return [...resultsBySequence.values()].sort((a, b) => a.sequence - b.sequence);
      } catch (error) {
        if (suiteRef.cancelled) {
          throw new BenchmarkRunCancelledError();
        }
        throw error;
      } finally {
        client.dispose();
        clearActiveSuite(request.suiteRunId);
      }
    },

    cancelSuite(suiteRunId) {
      if (!activeSuite || activeSuite.suiteRunId !== suiteRunId) {
        return;
      }

      activeSuite.cancelled = true;
      activeSuite.client.cancelSuite();
    },

    dispose() {
      if (!activeSuite) {
        return;
      }

      activeSuite.cancelled = true;
      activeSuite.client.dispose();
      activeSuite = null;
    },
  };
}
