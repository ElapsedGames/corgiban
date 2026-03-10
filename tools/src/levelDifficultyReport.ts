import { performance } from 'node:perf_hooks';

import type { BenchmarkEnvironmentSnapshot, BenchmarkRunRecord } from '@corgiban/benchmarks';
import { runBenchmarkSuite } from '@corgiban/benchmarks';
import { parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';
import {
  DEFAULT_ALGORITHM_ID,
  DEFAULT_NODE_BUDGET,
  analyzeLevel,
  isImplementedAlgorithmId,
  solve,
  type AlgorithmId,
  type SolveStatus,
} from '@corgiban/solver';

export const LEVEL_DIFFICULTY_SORTS = [
  'difficulty',
  'pushes',
  'moves',
  'generated',
  'elapsed',
] as const;

export type LevelDifficultySort = (typeof LEVEL_DIFFICULTY_SORTS)[number];

export type LevelDifficultyResult = {
  levelId: string;
  name: string;
  status: SolveStatus;
  withinTimeBudget: boolean;
  solutionPushCount: number | null;
  solutionMoveCount: number | null;
  elapsedMs: number;
  expanded: number;
  generated: number;
  maxDepth: number;
  maxFrontier: number;
  boxCount: number;
  walkableCount: number;
  reachableCount: number;
  errorMessage?: string;
  errorDetails?: string;
};

export type BenchmarkLevelDifficultyOptions = {
  algorithmId?: AlgorithmId;
  timeBudgetMs?: number;
  nodeBudget?: number;
  maxLevels?: number;
  environment: BenchmarkEnvironmentSnapshot;
  suiteRunId?: string;
};

export type FormatLevelDifficultyReportOptions = {
  algorithmId: AlgorithmId;
  timeBudgetMs: number;
  nodeBudget: number;
  sortBy: LevelDifficultySort;
};

const DEFAULT_TIME_BUDGET_MS = 15_000;

function compareNumbers(left: number, right: number): number {
  return left - right;
}

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === right) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }
  return left - right;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function compareBy<T>(
  result: LevelDifficultyResult,
  other: LevelDifficultyResult,
  select: (value: LevelDifficultyResult) => T,
  compare: (left: T, right: T) => number,
): number {
  return compare(select(result), select(other));
}

function solvedWithinBudgetRank(result: LevelDifficultyResult): number {
  if (result.status === 'solved' && result.withinTimeBudget) {
    return 0;
  }
  if (result.status === 'solved') {
    return 1;
  }
  if (result.status === 'timeout') {
    return 2;
  }
  if (result.status === 'unsolved') {
    return 3;
  }
  if (result.status === 'error') {
    return 4;
  }
  return 5;
}

function compareFailureTail(result: LevelDifficultyResult, other: LevelDifficultyResult): number {
  return (
    compareBy(result, other, (value) => value.elapsedMs, compareNumbers) ||
    compareBy(result, other, (value) => value.generated, compareNumbers) ||
    compareBy(result, other, (value) => value.expanded, compareNumbers) ||
    compareBy(result, other, (value) => value.levelId, compareStrings)
  );
}

export function compareLevelDifficulty(
  result: LevelDifficultyResult,
  other: LevelDifficultyResult,
  sortBy: LevelDifficultySort = 'difficulty',
): number {
  const budgetRankDifference = solvedWithinBudgetRank(result) - solvedWithinBudgetRank(other);
  if (budgetRankDifference !== 0) {
    return budgetRankDifference;
  }

  if (solvedWithinBudgetRank(result) !== 0) {
    return compareFailureTail(result, other);
  }

  if (sortBy === 'pushes') {
    return (
      compareBy(result, other, (value) => value.solutionPushCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.solutionMoveCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.elapsedMs, compareNumbers) ||
      compareBy(result, other, (value) => value.levelId, compareStrings)
    );
  }

  if (sortBy === 'moves') {
    return (
      compareBy(result, other, (value) => value.solutionMoveCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.solutionPushCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.elapsedMs, compareNumbers) ||
      compareBy(result, other, (value) => value.levelId, compareStrings)
    );
  }

  if (sortBy === 'generated') {
    return (
      compareBy(result, other, (value) => value.generated, compareNumbers) ||
      compareBy(result, other, (value) => value.solutionPushCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.solutionMoveCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.elapsedMs, compareNumbers) ||
      compareBy(result, other, (value) => value.levelId, compareStrings)
    );
  }

  if (sortBy === 'elapsed') {
    return (
      compareBy(result, other, (value) => value.elapsedMs, compareNumbers) ||
      compareBy(result, other, (value) => value.solutionPushCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.solutionMoveCount, compareNullableNumbers) ||
      compareBy(result, other, (value) => value.generated, compareNumbers) ||
      compareBy(result, other, (value) => value.levelId, compareStrings)
    );
  }

  return (
    compareBy(result, other, (value) => value.solutionPushCount, compareNullableNumbers) ||
    compareBy(result, other, (value) => value.solutionMoveCount, compareNullableNumbers) ||
    compareBy(result, other, (value) => value.generated, compareNumbers) ||
    compareBy(result, other, (value) => value.expanded, compareNumbers) ||
    compareBy(result, other, (value) => value.elapsedMs, compareNumbers) ||
    compareBy(result, other, (value) => value.boxCount, compareNumbers) ||
    compareBy(result, other, (value) => value.reachableCount, compareNumbers) ||
    compareBy(result, other, (value) => value.levelId, compareStrings)
  );
}

export function rankLevelDifficultyResults(
  results: readonly LevelDifficultyResult[],
  sortBy: LevelDifficultySort = 'difficulty',
): LevelDifficultyResult[] {
  return [...results].sort((left, right) => compareLevelDifficulty(left, right, sortBy));
}

export function hasLevelDifficultyFailures(results: readonly LevelDifficultyResult[]): boolean {
  return results.some((result) => !result.withinTimeBudget || result.status !== 'solved');
}

export function buildSuggestedLevelOrder(
  results: readonly LevelDifficultyResult[],
  sortBy: LevelDifficultySort = 'difficulty',
): string[] {
  return rankLevelDifficultyResults(results, sortBy).map((result) => result.levelId);
}

function describeSort(sortBy: LevelDifficultySort): string {
  if (sortBy === 'pushes') {
    return 'solved-first, then fewer pushes, then fewer moves';
  }
  if (sortBy === 'moves') {
    return 'solved-first, then fewer moves, then fewer pushes';
  }
  if (sortBy === 'generated') {
    return 'solved-first, then fewer generated states';
  }
  if (sortBy === 'elapsed') {
    return 'solved-first, then lower elapsed time';
  }
  return 'solved-first, then fewer pushes, fewer moves, lower search effort, then lower elapsed time';
}

function formatMaybeNumber(value: number | null): string {
  return value === null ? '-' : String(value);
}

export function formatLevelDifficultyReport(
  results: readonly LevelDifficultyResult[],
  options: FormatLevelDifficultyReportOptions,
): string {
  const ranked = rankLevelDifficultyResults(results, options.sortBy);
  const lines = [
    `Benchmarked ${ranked.length} levels with ${options.algorithmId}.`,
    `Budget: ${options.timeBudgetMs} ms, node budget: ${options.nodeBudget}.`,
    `Suggested sort: ${options.sortBy} (${describeSort(options.sortBy)}).`,
    '',
    'Suggested level order:',
  ];

  ranked.forEach((result, index) => {
    lines.push(
      `${index + 1}. ${result.levelId} | ${result.name} | ${result.status} | pushes ${formatMaybeNumber(result.solutionPushCount)} | moves ${formatMaybeNumber(result.solutionMoveCount)} | generated ${result.generated} | elapsed ${result.elapsedMs.toFixed(2)} ms`,
    );
  });

  const failures = ranked.filter(
    (result) => !result.withinTimeBudget || result.status !== 'solved',
  );
  if (failures.length > 0) {
    lines.push('', 'Over budget or unsolved:');
    failures.forEach((result) => {
      const message = result.errorMessage ? ` | ${result.errorMessage}` : '';
      lines.push(
        `- ${result.levelId} | ${result.name} | ${result.status} | elapsed ${result.elapsedMs.toFixed(2)} ms${message}`,
      );
    });
  }

  return lines.join('\n');
}

function toDifficultyResult(
  level: LevelDefinition,
  record: BenchmarkRunRecord,
  timeBudgetMs: number,
): LevelDifficultyResult {
  const runtime = parseLevel(level);
  const features = analyzeLevel(runtime);
  const solved = record.status === 'solved';

  return {
    levelId: level.id,
    name: level.name,
    status: record.status,
    withinTimeBudget: solved && record.metrics.elapsedMs <= timeBudgetMs,
    solutionPushCount: solved ? record.metrics.pushCount : null,
    solutionMoveCount: solved ? record.metrics.moveCount : null,
    elapsedMs: record.metrics.elapsedMs,
    expanded: record.metrics.expanded,
    generated: record.metrics.generated,
    maxDepth: record.metrics.maxDepth,
    maxFrontier: record.metrics.maxFrontier,
    boxCount: features.boxCount,
    walkableCount: features.walkableCount,
    reachableCount: features.reachableCount,
    ...(record.errorMessage ? { errorMessage: record.errorMessage } : {}),
    ...(record.errorDetails ? { errorDetails: record.errorDetails } : {}),
  };
}

export async function benchmarkLevelDifficulty(
  levels: readonly LevelDefinition[],
  options: BenchmarkLevelDifficultyOptions,
): Promise<LevelDifficultyResult[]> {
  const algorithmId = options.algorithmId ?? DEFAULT_ALGORITHM_ID;
  if (!isImplementedAlgorithmId(algorithmId)) {
    throw new Error(`Algorithm "${algorithmId}" is not implemented in this repo yet.`);
  }

  const timeBudgetMs = options.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const nodeBudget = options.nodeBudget ?? DEFAULT_NODE_BUDGET;
  const selectedLevels =
    options.maxLevels === undefined ? [...levels] : levels.slice(0, options.maxLevels);
  const levelsById = new Map(
    selectedLevels.map((level) => [level.id, { level, runtime: parseLevel(level) }] as const),
  );

  const records = await runBenchmarkSuite(
    {
      suiteRunId: options.suiteRunId ?? 'level-difficulty',
      suite: {
        levelIds: selectedLevels.map((level) => level.id),
        solverConfigs: [{ algorithmId }],
        repetitions: 1,
        warmupRepetitions: 0,
        timeBudgetMs,
        nodeBudget,
      },
      environment: options.environment,
    },
    {
      execute: (request) => {
        const entry = levelsById.get(request.levelId);
        if (!entry) {
          throw new Error(`Unknown level id "${request.levelId}" in difficulty benchmark.`);
        }

        return solve(entry.runtime, request.algorithmId, request.options, undefined, {
          nowMs: () => performance.now(),
        });
      },
    },
  );

  return records.map((record) => {
    const entry = levelsById.get(record.levelId);
    if (!entry) {
      throw new Error(`Unknown benchmark result level id "${record.levelId}".`);
    }
    return toDifficultyResult(entry.level, record, timeBudgetMs);
  });
}
