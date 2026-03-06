import type { LevelRuntime } from '@corgiban/core';

import type { SolveContext } from './algorithm';
import { CLOCK_UNAVAILABLE_ERROR_MESSAGE, resolveNowMs, safeElapsedMs } from './clock';
import { getAlgorithm } from './registry';
import type {
  AlgorithmId,
  SolveErrorResult,
  SolveResult,
  SolverHooks,
  SolverMetrics,
  SolverOptions,
} from './solverTypes';
import { normalizeSolverOptions } from './solverOptions';
import { compileLevel } from '../state/compiledLevel';
import { createZobristTable } from '../infra/zobrist';

function buildEmptyMetrics(elapsedMs: number): SolverMetrics {
  return {
    elapsedMs,
    expanded: 0,
    generated: 0,
    maxDepth: 0,
    maxFrontier: 0,
    pushCount: 0,
    moveCount: 0,
  };
}

function toErrorDetails(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return undefined;
}

function buildErrorResult(
  elapsedMs: number,
  errorMessage: string,
  errorDetails?: string,
): SolveErrorResult {
  return {
    status: 'error',
    metrics: buildEmptyMetrics(elapsedMs),
    errorMessage,
    ...(errorDetails ? { errorDetails } : {}),
  };
}

export function solve(
  level: LevelRuntime,
  algorithmId: AlgorithmId,
  options?: SolverOptions,
  hooks?: SolverHooks,
  context: SolveContext = {},
): SolveResult {
  const nowMs = resolveNowMs(context);
  if (!nowMs) {
    return buildErrorResult(0, CLOCK_UNAVAILABLE_ERROR_MESSAGE);
  }

  let startMs = 0;

  try {
    startMs = nowMs();
    const normalizedOptions = normalizeSolverOptions(algorithmId, options);
    const compiled = compileLevel(level);
    const zobrist = createZobristTable(compiled.cellCount);
    const algorithm = getAlgorithm(algorithmId);

    if (!algorithm) {
      const elapsedMs = safeElapsedMs(nowMs, startMs);
      return buildErrorResult(
        elapsedMs,
        `Algorithm "${algorithmId}" is not registered in the solver registry.`,
      );
    }

    return algorithm.solve({
      level,
      compiled,
      zobrist,
      options: normalizedOptions,
      hooks,
      context: { ...context, nowMs },
    });
  } catch (error) {
    const elapsedMs = safeElapsedMs(nowMs, startMs);
    return buildErrorResult(
      elapsedMs,
      `Solver run failed for algorithm "${algorithmId}".`,
      toErrorDetails(error),
    );
  }
}
