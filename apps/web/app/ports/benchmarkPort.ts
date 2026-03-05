import type { LevelRuntime } from '@corgiban/core';
import type { AlgorithmId, SolverOptions } from '@corgiban/solver';
import type { BenchmarkRunRecord } from '@corgiban/benchmarks';

export type { BenchmarkRunRecord };

export type BenchmarkEnvironmentSnapshot = {
  userAgent: string;
  hardwareConcurrency: number;
  appVersion: string;
};

export type BenchmarkSuiteConfig = {
  levelIds: string[];
  algorithmIds: AlgorithmId[];
  repetitions: number;
  timeBudgetMs: number;
  nodeBudget: number;
  algorithmOptions?: Partial<Record<AlgorithmId, SolverOptions>>;
};

export type BenchmarkProgress = {
  suiteRunId: string;
  totalRuns: number;
  completedRuns: number;
  latestResultId?: string;
};

export type BenchmarkWorkerProgress = {
  suiteRunId: string;
  runId: string;
  sequence: number;
  levelId: string;
  algorithmId: AlgorithmId;
  repetition: number;
  expanded: number;
  generated: number;
  depth: number;
  frontier: number;
  elapsedMs: number;
  bestHeuristic?: number;
  bestPathSoFar?: string;
};

export type BenchmarkSuiteRunRequest = {
  suiteRunId: string;
  suite: BenchmarkSuiteConfig;
  levelResolver: (levelId: string) => LevelRuntime;
  onResult?: (result: BenchmarkRunRecord) => void;
  onProgress?: (progress: BenchmarkProgress) => void;
  onWorkerProgress?: (progress: BenchmarkWorkerProgress) => void;
};

export type BenchmarkPort = {
  runSuite: (request: BenchmarkSuiteRunRequest) => Promise<BenchmarkRunRecord[]>;
  cancelSuite: (suiteRunId: string) => void;
  dispose: () => void;
};

export class BenchmarkRunCancelledError extends Error {
  readonly code = 'BENCHMARK_RUN_CANCELLED' as const;

  constructor(message = 'Benchmark run cancelled.') {
    super(message);
    this.name = 'BenchmarkRunCancelledError';
  }
}

export function createNoopBenchmarkPort(): BenchmarkPort {
  return {
    runSuite: async () => {
      throw new Error('Benchmark worker is unavailable in this environment.');
    },
    cancelSuite: () => undefined,
    dispose: () => undefined,
  };
}
