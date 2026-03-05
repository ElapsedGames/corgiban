import {
  ALGORITHM_IDS,
  HEURISTIC_IDS,
  MAX_HEURISTIC_WEIGHT,
  MIN_HEURISTIC_WEIGHT,
} from '@corgiban/solver';

import type { BenchmarkRunRecord } from './benchmarkTypes';

export const BENCHMARK_DB_NAME = 'corgiban-benchmark';
export const BENCHMARK_DB_VERSION = 2;
export const BENCHMARK_REPORT_TYPE = 'corgiban-benchmark-report';
export const BENCHMARK_REPORT_VERSION = 2;
export const BENCHMARK_REPORT_EXPORT_MODEL = 'multi-suite-history';

export const BENCHMARK_DB_STORES = {
  runs: 'benchmarkResults',
} as const;

export const BENCHMARK_DB_INDEXES = {
  runsBySuiteRunId: 'bySuiteRunId',
  runsByFinishedAtMs: 'byFinishedAtMs',
} as const;

export const BENCHMARK_DB_SCHEMA = {
  name: BENCHMARK_DB_NAME,
  version: BENCHMARK_DB_VERSION,
  stores: BENCHMARK_DB_STORES,
  indexes: BENCHMARK_DB_INDEXES,
} as const;

export const DEFAULT_BENCHMARK_RETENTION_LIMIT = 100;

const SOLVE_STATUSES = ['solved', 'unsolved', 'timeout', 'cancelled', 'error'] as const;
const algorithmIdSet = new Set<string>(ALGORITHM_IDS);
const heuristicIdSet = new Set<string>(HEURISTIC_IDS);
const solveStatusSet = new Set<string>(SOLVE_STATUSES);

const solverOptionKeys = new Set([
  'timeBudgetMs',
  'nodeBudget',
  'heuristicId',
  'heuristicWeight',
  'enableSpectatorStream',
]);
const solverMetadataKeys = new Set([
  'algorithmId',
  'heuristicId',
  'heuristicWeight',
  'timeBudgetMs',
  'nodeBudget',
  'enableSpectatorStream',
]);
const environmentKeys = new Set(['userAgent', 'hardwareConcurrency', 'appVersion']);
const metricsKeys = new Set([
  'elapsedMs',
  'expanded',
  'generated',
  'maxDepth',
  'maxFrontier',
  'pushCount',
  'moveCount',
]);
const comparableMetadataKeys = new Set([
  'solver',
  'environment',
  'warmupEnabled',
  'warmupRepetitions',
]);
const benchmarkRunRecordKeys = new Set([
  'id',
  'suiteRunId',
  'runId',
  'sequence',
  'levelId',
  'algorithmId',
  'repetition',
  'warmup',
  'options',
  'status',
  'metrics',
  'startedAtMs',
  'finishedAtMs',
  'solutionMoves',
  'errorMessage',
  'errorDetails',
  'environment',
  'comparableMetadata',
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasString(value: unknown): value is string {
  return typeof value === 'string';
}

function hasBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function hasPositiveNumber(value: unknown): value is number {
  return hasNumber(value) && value > 0;
}

function hasNonNegativeNumber(value: unknown): value is number {
  return hasNumber(value) && value >= 0;
}

function hasPositiveInteger(value: unknown): value is number {
  return hasPositiveNumber(value) && Number.isInteger(value);
}

function hasNonNegativeInteger(value: unknown): value is number {
  return hasNonNegativeNumber(value) && Number.isInteger(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isBenchmarkEnvironment(value: unknown): boolean {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, environmentKeys)) {
    return false;
  }

  return (
    hasString(value.userAgent) &&
    hasNonNegativeNumber(value.hardwareConcurrency) &&
    hasString(value.appVersion)
  );
}

function isBenchmarkMetrics(value: unknown): boolean {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, metricsKeys)) {
    return false;
  }

  return (
    hasNonNegativeNumber(value.elapsedMs) &&
    hasNonNegativeNumber(value.expanded) &&
    hasNonNegativeNumber(value.generated) &&
    hasNonNegativeNumber(value.maxDepth) &&
    hasNonNegativeNumber(value.maxFrontier) &&
    hasNonNegativeNumber(value.pushCount) &&
    hasNonNegativeNumber(value.moveCount)
  );
}

function isBenchmarkSolverOptions(value: unknown): boolean {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, solverOptionKeys)) {
    return false;
  }

  if (value.timeBudgetMs !== undefined && !hasPositiveNumber(value.timeBudgetMs)) {
    return false;
  }

  if (value.nodeBudget !== undefined && !hasPositiveNumber(value.nodeBudget)) {
    return false;
  }

  if (value.heuristicId !== undefined && !heuristicIdSet.has(value.heuristicId as string)) {
    return false;
  }

  if (value.heuristicWeight !== undefined) {
    if (
      !hasNumber(value.heuristicWeight) ||
      value.heuristicWeight < MIN_HEURISTIC_WEIGHT ||
      value.heuristicWeight > MAX_HEURISTIC_WEIGHT
    ) {
      return false;
    }
  }

  if (value.enableSpectatorStream !== undefined && !hasBoolean(value.enableSpectatorStream)) {
    return false;
  }

  return true;
}

function isBenchmarkSolverMetadata(value: unknown): boolean {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, solverMetadataKeys)) {
    return false;
  }

  if (!hasString(value.algorithmId) || !algorithmIdSet.has(value.algorithmId)) {
    return false;
  }

  if (value.heuristicId !== undefined && !heuristicIdSet.has(value.heuristicId as string)) {
    return false;
  }

  if (value.heuristicWeight !== undefined) {
    if (
      !hasNumber(value.heuristicWeight) ||
      value.heuristicWeight < MIN_HEURISTIC_WEIGHT ||
      value.heuristicWeight > MAX_HEURISTIC_WEIGHT
    ) {
      return false;
    }
  }

  if (value.timeBudgetMs !== undefined && !hasPositiveNumber(value.timeBudgetMs)) {
    return false;
  }

  if (value.nodeBudget !== undefined && !hasPositiveNumber(value.nodeBudget)) {
    return false;
  }

  if (value.enableSpectatorStream !== undefined && !hasBoolean(value.enableSpectatorStream)) {
    return false;
  }

  return true;
}

function isBenchmarkComparableMetadata(value: unknown): boolean {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, comparableMetadataKeys)) {
    return false;
  }

  return (
    isBenchmarkSolverMetadata(value.solver) &&
    isBenchmarkEnvironment(value.environment) &&
    hasBoolean(value.warmupEnabled) &&
    hasNonNegativeInteger(value.warmupRepetitions)
  );
}

export function isBenchmarkRunRecord(value: unknown): value is BenchmarkRunRecord {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, benchmarkRunRecordKeys)) {
    return false;
  }

  return (
    hasString(value.id) &&
    hasString(value.suiteRunId) &&
    hasString(value.runId) &&
    hasPositiveInteger(value.sequence) &&
    hasString(value.levelId) &&
    hasString(value.algorithmId) &&
    algorithmIdSet.has(value.algorithmId) &&
    hasPositiveInteger(value.repetition) &&
    (value.warmup !== undefined ? hasBoolean(value.warmup) : true) &&
    isBenchmarkSolverOptions(value.options) &&
    hasString(value.status) &&
    solveStatusSet.has(value.status) &&
    isBenchmarkMetrics(value.metrics) &&
    hasNumber(value.startedAtMs) &&
    hasNumber(value.finishedAtMs) &&
    value.finishedAtMs >= value.startedAtMs &&
    (value.solutionMoves === undefined ? true : hasString(value.solutionMoves)) &&
    (value.errorMessage === undefined ? true : hasString(value.errorMessage)) &&
    (value.errorDetails === undefined ? true : hasString(value.errorDetails)) &&
    (value.comparableMetadata === undefined
      ? true
      : isBenchmarkComparableMetadata(value.comparableMetadata)) &&
    (value.status !== 'error' || hasString(value.errorMessage)) &&
    isBenchmarkEnvironment(value.environment)
  );
}
