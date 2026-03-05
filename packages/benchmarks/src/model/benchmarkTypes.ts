import type {
  AlgorithmId,
  HeuristicId,
  SolveResult,
  SolveStatus,
  SolverMetrics,
  SolverOptions,
} from '@corgiban/solver';

export type BenchmarkEnvironmentSnapshot = {
  userAgent: string;
  hardwareConcurrency: number;
  appVersion: string;
};

export type BenchmarkSolverOptionMetadata = {
  algorithmId: AlgorithmId;
  heuristicId?: HeuristicId;
  heuristicWeight?: number;
  timeBudgetMs?: number;
  nodeBudget?: number;
  enableSpectatorStream?: boolean;
};

export type BenchmarkComparableMetadata = {
  solver: BenchmarkSolverOptionMetadata;
  environment: BenchmarkEnvironmentSnapshot;
  warmupEnabled: boolean;
  warmupRepetitions: number;
};

export type BenchmarkAlgorithmConfig = {
  algorithmId: AlgorithmId;
  options?: SolverOptions;
};

export type BenchmarkSuite = {
  levelIds: string[];
  solverConfigs: BenchmarkAlgorithmConfig[];
  repetitions: number;
  warmupRepetitions?: number;
  timeBudgetMs: number;
  nodeBudget: number;
};

export type BenchmarkRunRecord = {
  id: string;
  suiteRunId: string;
  runId: string;
  sequence: number;
  levelId: string;
  algorithmId: AlgorithmId;
  repetition: number;
  warmup?: boolean;
  options: SolverOptions;
  status: SolveStatus;
  metrics: SolverMetrics;
  startedAtMs: number;
  finishedAtMs: number;
  solutionMoves?: string;
  errorMessage?: string;
  errorDetails?: string;
  environment: BenchmarkEnvironmentSnapshot;
  comparableMetadata?: BenchmarkComparableMetadata;
};

export type BenchmarkRunExecutionRequest = {
  suiteRunId: string;
  runId: string;
  levelId: string;
  algorithmId: AlgorithmId;
  options: SolverOptions;
  repetition: number;
  warmup: boolean;
};

export type BenchmarkRunPlan = BenchmarkRunExecutionRequest & {
  sequence: number;
};

export type BenchmarkRunnerExecute = (
  request: BenchmarkRunExecutionRequest,
) => Promise<SolveResult> | SolveResult;

export type BenchmarkRunnerProgress = {
  suiteRunId: string;
  totalRuns: number;
  completedRuns: number;
  latestResultId?: string;
};

export type BenchmarkSuiteRunRequest = {
  suiteRunId: string;
  suite: BenchmarkSuite;
  environment: BenchmarkEnvironmentSnapshot;
  onResult?: (result: BenchmarkRunRecord) => void;
  onProgress?: (progress: BenchmarkRunnerProgress) => void;
};

export type BenchmarkRunOutcome = {
  status: SolveStatus;
  metrics: SolverMetrics;
  solutionMoves?: string;
  errorMessage?: string;
  errorDetails?: string;
};
