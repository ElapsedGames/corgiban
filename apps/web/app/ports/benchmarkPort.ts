import type { LevelRuntime } from '@corgiban/core';
import type { AlgorithmId, SolverOptions } from '@corgiban/solver';
import type { PlayableEntry } from '../levels/temporaryLevelCatalog';
import type { BenchmarkRunRecord } from '../bench/benchmarkRecord';

export type { BenchmarkRunRecord };

export type BenchmarkEnvironmentSnapshot = {
  userAgent: string;
  hardwareConcurrency: number;
  appVersion: string;
};

export type BenchmarkSuiteConfig = {
  levelRefs?: string[];
  levelIds: string[];
  algorithmIds: AlgorithmId[];
  repetitions: number;
  warmupRepetitions?: number;
  timeBudgetMs: number;
  nodeBudget: number;
  algorithmOptions?: Partial<Record<AlgorithmId, SolverOptions>>;
};

export function getBenchmarkSuiteLevelRefs(suite: BenchmarkSuiteConfig): string[] {
  return suite.levelRefs ?? suite.levelIds ?? [];
}

export type BenchmarkProgress = {
  suiteRunId: string;
  totalRuns: number;
  completedRuns: number;
  latestResultId?: string;
};

export type BenchmarkWorkerProgress = {
  suiteRunId: string;
  runId: string;
  planSequence: number;
  measuredSequence: number | null;
  warmup: boolean;
  levelRef: string;
  levelId: string;
  levelName: string;
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
  levelResolver: (levelRef: string) => LevelRuntime;
  levelEntryResolver?: (levelRef: string) => PlayableEntry | null;
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
