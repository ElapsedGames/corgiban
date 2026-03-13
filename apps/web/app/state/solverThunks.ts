import type { LevelRuntime } from '@corgiban/core';
import {
  DEFAULT_ALGORITHM_ID,
  DEFAULT_NODE_BUDGET,
  DEFAULT_SOLVER_TIME_BUDGET_MS,
  analyzeLevel,
  chooseAlgorithm,
  isImplementedAlgorithmId,
} from '@corgiban/solver';
import type { AlgorithmId, SolverOptions } from '@corgiban/solver';

import { nextLevel } from './gameSlice';
import type { AppThunk } from './store';
import {
  resetSolverRunState,
  setRecommendation,
  setSelectedAlgorithmId,
  setWorkerHealth,
  solveCancelRequested,
  solveRunCancelled,
  solveProgressReceived,
  solveRunCompleted,
  solveRunFailed,
  solveRunStarted,
  workerRetried,
} from './solverSlice';

let runCounter = 0;

function nextRunId(): string {
  runCounter += 1;
  return `solve-${runCounter}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown solver error.';
}

function isRunCancelledError(error: unknown): boolean {
  return error instanceof Error && error.name === 'SolverRunCancelledError';
}

function resolvePositiveBudget(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

export type StartSolveArgs = {
  levelRuntime: LevelRuntime;
  algorithmId?: AlgorithmId;
  options?: SolverOptions;
  activeRunPolicy?: 'reject' | 'replace';
};

type HandleLevelChangeOptions = {
  levelRef?: string;
  levelId?: string;
  exactLevelKey?: string | null;
  pendingAlgorithmId?: AlgorithmId | null;
};

function resolveRunnableAlgorithmId(
  requestedAlgorithmId: AlgorithmId | undefined,
  recommendedAlgorithmId: AlgorithmId,
): AlgorithmId {
  if (requestedAlgorithmId && isImplementedAlgorithmId(requestedAlgorithmId)) {
    return requestedAlgorithmId;
  }
  if (isImplementedAlgorithmId(recommendedAlgorithmId)) {
    return recommendedAlgorithmId;
  }
  return DEFAULT_ALGORITHM_ID;
}

export const recommendSolverForLevel =
  (levelRuntime: LevelRuntime): AppThunk =>
  (dispatch) => {
    const features = analyzeLevel(levelRuntime);
    const algorithmId = chooseAlgorithm(features);
    dispatch(setRecommendation({ algorithmId, features }));
    dispatch(setSelectedAlgorithmId(algorithmId));
  };

export const applyRequestedAlgorithmSelection =
  (levelRuntime: LevelRuntime, requestedAlgorithmId?: AlgorithmId | null): AppThunk =>
  (dispatch) => {
    const features = analyzeLevel(levelRuntime);
    const recommendedAlgorithmId = chooseAlgorithm(features);
    dispatch(setRecommendation({ algorithmId: recommendedAlgorithmId, features }));
    dispatch(
      setSelectedAlgorithmId(
        resolveRunnableAlgorithmId(requestedAlgorithmId ?? undefined, recommendedAlgorithmId),
      ),
    );
  };

export const handleLevelChange =
  (levelRuntime: LevelRuntime, options: HandleLevelChangeOptions = {}): AppThunk =>
  (dispatch, getState, { solverPort }) => {
    const activeRunId = getState().solver.activeRunId;
    if (activeRunId) {
      dispatch(solveCancelRequested({ runId: activeRunId }));
      solverPort.cancelSolve(activeRunId);
    }

    if (options.levelRef && options.levelId) {
      dispatch(
        nextLevel({
          levelRef: options.levelRef,
          levelId: options.levelId,
          ...(options.exactLevelKey ? { exactLevelKey: options.exactLevelKey } : {}),
        }),
      );
    }

    dispatch(resetSolverRunState());
    applyRequestedAlgorithmSelection(levelRuntime, options.pendingAlgorithmId)(dispatch, getState, {
      solverPort,
    });
  };

export const startSolve =
  ({
    levelRuntime,
    algorithmId,
    options,
    activeRunPolicy,
  }: StartSolveArgs): AppThunk<Promise<void>> =>
  async (dispatch, getState, { solverPort }) => {
    const activeRunId = getState().solver.activeRunId;
    if (activeRunId) {
      if (activeRunPolicy !== 'replace') {
        return;
      }
      dispatch(solveCancelRequested({ runId: activeRunId }));
      solverPort.cancelSolve(activeRunId);
    }

    const features = analyzeLevel(levelRuntime);
    const recommendedAlgorithmId = chooseAlgorithm(features);
    dispatch(setRecommendation({ algorithmId: recommendedAlgorithmId, features }));

    const selectedAlgorithmId = resolveRunnableAlgorithmId(
      algorithmId ?? getState().solver.selectedAlgorithmId ?? undefined,
      recommendedAlgorithmId,
    );
    const runId = nextRunId();
    const settings = getState().settings;
    const defaultTimeBudgetMs = resolvePositiveBudget(
      settings.solverTimeBudgetMs,
      DEFAULT_SOLVER_TIME_BUDGET_MS,
    );
    const defaultNodeBudget = resolvePositiveBudget(settings.solverNodeBudget, DEFAULT_NODE_BUDGET);
    const mergedOptions = {
      ...options,
      timeBudgetMs: resolvePositiveBudget(options?.timeBudgetMs, defaultTimeBudgetMs),
      nodeBudget: resolvePositiveBudget(options?.nodeBudget, defaultNodeBudget),
    };

    dispatch(solveRunStarted({ runId, algorithmId: selectedAlgorithmId }));

    try {
      const result = await solverPort.startSolve({
        runId,
        levelRuntime,
        algorithmId: selectedAlgorithmId,
        options: mergedOptions,
        onProgress: (progress) => {
          dispatch(solveProgressReceived({ runId, progress }));
        },
      });

      dispatch(solveRunCompleted(result));
    } catch (error) {
      if (isRunCancelledError(error)) {
        dispatch(solveRunCancelled({ runId }));
        return;
      }
      dispatch(
        solveRunFailed({
          runId,
          message: toErrorMessage(error),
        }),
      );
    }
  };

export const cancelSolve =
  (): AppThunk =>
  (dispatch, getState, { solverPort }) => {
    const runId = getState().solver.activeRunId;
    if (!runId) {
      return;
    }

    dispatch(solveCancelRequested({ runId }));
    solverPort.cancelSolve(runId);
  };

export const retryWorker =
  (): AppThunk =>
  (dispatch, _getState, { solverPort }) => {
    solverPort.retryWorker();
    dispatch(workerRetried());
    dispatch(setWorkerHealth(solverPort.getWorkerHealth()));
  };
