import { describe, expect, it, vi } from 'vitest';

import { parseLevel } from '@corgiban/core';
import { DEFAULT_NODE_BUDGET, DEFAULT_SOLVER_TIME_BUDGET_MS } from '@corgiban/solver';
import * as solverApi from '@corgiban/solver';

import type { SolverPort } from '../../ports/solverPort';
import {
  cancelSolve,
  handleLevelChange,
  recommendSolverForLevel,
  retryWorker,
  startSolve,
} from '../solverThunks';
import { benchSlice } from '../benchSlice';
import { gameSlice, nextLevel } from '../gameSlice';
import { settingsSlice } from '../settingsSlice';
import { createAppStore } from '../store';
import {
  resetSolverRunState,
  setRecommendation,
  setSelectedAlgorithmId,
  setWorkerHealth,
  solveCancelRequested,
  solveRunCancelled,
  solveRunCompleted,
  solveRunFailed,
  solveProgressReceived,
  solveRunStarted,
  solverSlice,
  workerRetried,
} from '../solverSlice';

const baseState = () => ({
  bench: benchSlice.reducer(undefined, { type: 'unknown' }),
  game: gameSlice.reducer(undefined, { type: 'unknown' }),
  settings: settingsSlice.reducer(undefined, { type: 'unknown' }),
  solver: solverSlice.reducer(undefined, { type: 'unknown' }),
});

const noopSolverPort: SolverPort = {
  startSolve: async () => {
    throw new Error('not used');
  },
  cancelSolve: () => undefined,
  pingWorker: async () => undefined,
  retryWorker: () => undefined,
  getWorkerHealth: () => 'idle',
  subscribeWorkerHealth: () => () => undefined,
  dispose: () => undefined,
};

describe('solverThunks', () => {
  it('resolves algorithmId before starting a solve', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startCalls: string[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        startCalls.push(request.algorithmId);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => baseState();

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(startCalls[0]).toBe('bfsPush');
  });

  it('uses an explicitly requested implemented algorithm without fallback', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startCalls: string[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        startCalls.push(request.algorithmId);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();

    await startSolve({ levelRuntime, algorithmId: 'bfsPush' })(dispatch, () => baseState(), {
      solverPort,
    });

    expect(startCalls[0]).toBe('bfsPush');
  });

  it('dispatches recommendation and selected algorithm for a level', () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const dispatch = vi.fn();

    recommendSolverForLevel(levelRuntime)(dispatch, () => baseState(), {
      solverPort: noopSolverPort,
    });

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[0]?.[0].type).toBe(setRecommendation.type);
    expect(dispatch.mock.calls[1]?.[0].type).toBe(setSelectedAlgorithmId.type);
    expect(dispatch.mock.calls[0]?.[0].payload.algorithmId).toBe('bfsPush');
    expect(dispatch.mock.calls[1]?.[0].payload).toBe('bfsPush');
  });

  it('falls back to bfsPush when an unavailable explicit algorithmId is provided', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startCalls: string[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        startCalls.push(request.algorithmId);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => baseState();

    await startSolve({ levelRuntime, algorithmId: 'astarPush' })(dispatch, getState, {
      solverPort,
    });

    expect(startCalls[0]).toBe('bfsPush');
  });

  it('falls back to bfsPush when selectedAlgorithmId in state is unavailable', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startCalls: string[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        startCalls.push(request.algorithmId);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      solver: {
        ...baseState().solver,
        selectedAlgorithmId: 'astarPush' as const,
      },
    });

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(startCalls[0]).toBe('bfsPush');
  });

  it('falls back to default algorithm when recommendation resolves to an unavailable id', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startCalls: string[] = [];
    const chooseSpy = vi.spyOn(solverApi, 'chooseAlgorithm').mockReturnValue('idaStarPush');

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        startCalls.push(request.algorithmId);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    try {
      const dispatch = vi.fn();
      await startSolve({ levelRuntime })(dispatch, () => baseState(), { solverPort });

      expect(chooseSpy).toHaveBeenCalledTimes(1);
      expect(startCalls[0]).toBe('bfsPush');
    } finally {
      chooseSpy.mockRestore();
    }
  });

  it('applies default budgets when no options are provided', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const capturedOptions: unknown[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        capturedOptions.push(request.options);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    await startSolve({ levelRuntime })(dispatch, () => baseState(), { solverPort });

    expect(
      (capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).timeBudgetMs,
    ).toBe(DEFAULT_SOLVER_TIME_BUDGET_MS);
    expect((capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).nodeBudget).toBe(
      DEFAULT_NODE_BUDGET,
    );
  });

  it('uses settings-backed budget defaults when they are valid', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const capturedOptions: unknown[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        capturedOptions.push(request.options);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      settings: {
        ...baseState().settings,
        solverTimeBudgetMs: 12_345,
        solverNodeBudget: 678_901,
      },
    });

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(
      (capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).timeBudgetMs,
    ).toBe(12_345);
    expect((capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).nodeBudget).toBe(
      678_901,
    );
  });

  it('falls back to solver constants when settings budgets are invalid', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const capturedOptions: unknown[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        capturedOptions.push(request.options);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      settings: {
        ...baseState().settings,
        solverTimeBudgetMs: 0,
        solverNodeBudget: -1,
      },
    });

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(
      (capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).timeBudgetMs,
    ).toBe(DEFAULT_SOLVER_TIME_BUDGET_MS);
    expect((capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).nodeBudget).toBe(
      DEFAULT_NODE_BUDGET,
    );
  });

  it('falls back to valid defaults when caller supplies invalid budget options', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const capturedOptions: unknown[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        capturedOptions.push(request.options);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    await startSolve({ levelRuntime, options: { timeBudgetMs: 0, nodeBudget: -1 } })(
      dispatch,
      () => baseState(),
      { solverPort },
    );

    expect(
      (capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).timeBudgetMs,
    ).toBe(DEFAULT_SOLVER_TIME_BUDGET_MS);
    expect((capturedOptions[0] as { timeBudgetMs?: number; nodeBudget?: number }).nodeBudget).toBe(
      DEFAULT_NODE_BUDGET,
    );
  });

  it('caller-supplied timeBudgetMs overrides the default', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const capturedOptions: unknown[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        capturedOptions.push(request.options);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    await startSolve({ levelRuntime, options: { timeBudgetMs: 5_000 } })(
      dispatch,
      () => baseState(),
      { solverPort },
    );

    expect((capturedOptions[0] as { timeBudgetMs?: number }).timeBudgetMs).toBe(5_000);
    expect((capturedOptions[0] as { nodeBudget?: number }).nodeBudget).toBe(DEFAULT_NODE_BUDGET);
  });

  it('caller-supplied nodeBudget overrides the default', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const capturedOptions: unknown[] = [];

    const solverPort: SolverPort = {
      startSolve: async (request) => {
        capturedOptions.push(request.options);
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 0,
            expanded: 0,
            generated: 0,
            maxDepth: 0,
            maxFrontier: 0,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    await startSolve({ levelRuntime, options: { nodeBudget: 123_456 } })(
      dispatch,
      () => baseState(),
      { solverPort },
    );

    expect((capturedOptions[0] as { nodeBudget?: number }).nodeBudget).toBe(123_456);
    expect((capturedOptions[0] as { timeBudgetMs?: number }).timeBudgetMs).toBe(
      DEFAULT_SOLVER_TIME_BUDGET_MS,
    );
  });

  it('dispatches solveRunFailed when solverPort rejects', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const solverPort: SolverPort = {
      startSolve: async () => {
        throw new Error('solver failed');
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => baseState();

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunStarted.type);
    const failureAction = dispatch.mock.calls.find(
      ([action]) => action.type === solveRunFailed.type,
    )?.[0];

    expect(failureAction).toBeDefined();
    expect(failureAction?.payload.message).toBe('solver failed');
    expect(failureAction?.payload.runId).toMatch(/^solve-/);
  });

  it('dispatches solveProgressReceived when solverPort emits progress', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const solverPort: SolverPort = {
      startSolve: async (request) => {
        request.onProgress?.({
          runId: request.runId,
          expanded: 1,
          generated: 2,
          depth: 0,
          frontier: 1,
          elapsedMs: 3,
        });
        return {
          runId: request.runId,
          algorithmId: request.algorithmId,
          status: 'unsolved',
          metrics: {
            elapsedMs: 3,
            expanded: 1,
            generated: 2,
            maxDepth: 0,
            maxFrontier: 1,
            pushCount: 0,
            moveCount: 0,
          },
        };
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    await startSolve({ levelRuntime })(dispatch, () => baseState(), { solverPort });

    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(
      solveProgressReceived.type,
    );
  });

  it('maps non-Error solver failures to readable messages', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const asStringPort: SolverPort = {
      startSolve: async () => {
        throw 'string failure';
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    await startSolve({ levelRuntime })(dispatch, () => baseState(), { solverPort: asStringPort });

    const stringFailure = dispatch.mock.calls.find(
      ([action]) => action.type === solveRunFailed.type,
    );
    expect(stringFailure?.[0]?.payload.message).toBe('string failure');

    const unknownPort: SolverPort = {
      ...asStringPort,
      startSolve: async () => {
        throw { code: 500 };
      },
    };

    const dispatchUnknown = vi.fn();
    await startSolve({ levelRuntime })(dispatchUnknown, () => baseState(), {
      solverPort: unknownPort,
    });

    const unknownFailure = dispatchUnknown.mock.calls.find(
      ([action]) => action.type === solveRunFailed.type,
    );
    expect(unknownFailure?.[0]?.payload.message).toBe('Unknown solver error.');
  });

  it('dispatches solveRunCancelled for explicit cancellation errors', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const cancelError = new Error('cancelled');
    cancelError.name = 'SolverRunCancelledError';
    const solverPort: SolverPort = {
      startSolve: async () => {
        throw cancelError;
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => baseState();

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunStarted.type);
    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunCancelled.type);
    expect(dispatch.mock.calls.map(([action]) => action.type)).not.toContain(solveRunFailed.type);
  });

  it('dispatches solveRunCompleted for SOLVE_RESULT status error payloads', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const solverPort: SolverPort = {
      startSolve: async (request) => ({
        runId: request.runId,
        algorithmId: request.algorithmId,
        status: 'error',
        errorMessage: 'Algorithm "astarPush" is not registered in the solver registry.',
        errorDetails: 'Missing registry entry.',
        metrics: {
          elapsedMs: 0,
          expanded: 0,
          generated: 0,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      }),
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };

    const dispatch = vi.fn();
    const getState = () => baseState();

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunStarted.type);
    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunCompleted.type);
    expect(dispatch.mock.calls.map(([action]) => action.type)).not.toContain(solveRunFailed.type);
  });

  it('does not start a new solve when an active run exists and policy is reject', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startSolveMock = vi.fn(async (_request: Parameters<SolverPort['startSolve']>[0]) => {
      throw new Error('should not be called');
    });
    const cancelSolveMock = vi.fn((_runId: string) => undefined);
    const solverPort: SolverPort = {
      startSolve: startSolveMock,
      cancelSolve: cancelSolveMock,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };
    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      solver: {
        ...baseState().solver,
        activeRunId: 'run-active',
      },
    });

    await startSolve({ levelRuntime })(dispatch, getState, { solverPort });

    expect(startSolveMock).not.toHaveBeenCalled();
    expect(cancelSolveMock).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('cancels active run and starts a new solve when policy is replace', async () => {
    const levelRuntime = parseLevel({ id: 'level', name: 'Level', rows: ['P'] });
    const startSolveMock = vi.fn(async (request: Parameters<SolverPort['startSolve']>[0]) => ({
      runId: request.runId,
      algorithmId: request.algorithmId,
      status: 'unsolved' as const,
      metrics: {
        elapsedMs: 0,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    }));
    const cancelSolveMock = vi.fn((_runId: string) => undefined);
    const solverPort: SolverPort = {
      startSolve: startSolveMock,
      cancelSolve: cancelSolveMock,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };
    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      solver: {
        ...baseState().solver,
        activeRunId: 'run-active',
      },
    });

    await startSolve({ levelRuntime, activeRunPolicy: 'replace' })(dispatch, getState, {
      solverPort,
    });

    expect(cancelSolveMock).toHaveBeenCalledWith('run-active');
    expect(startSolveMock).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveCancelRequested.type);
    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunStarted.type);
    expect(dispatch.mock.calls.map(([action]) => action.type)).toContain(solveRunCompleted.type);
  });

  it('cancels an active run during level change before resetting solver state', () => {
    const levelRuntime = parseLevel({ id: 'level-b', name: 'Level B', rows: ['P'] });
    const solverPort: SolverPort = {
      ...noopSolverPort,
      cancelSolve: vi.fn(),
    };
    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      solver: {
        ...baseState().solver,
        activeRunId: 'run-active',
      },
    });

    handleLevelChange(levelRuntime)(dispatch, getState, { solverPort });

    expect(solverPort.cancelSolve).toHaveBeenCalledWith('run-active');
    expect(dispatch.mock.calls.map(([action]) => action.type)).toEqual([
      solveCancelRequested.type,
      resetSolverRunState.type,
      setRecommendation.type,
      setSelectedAlgorithmId.type,
    ]);
  });

  it('cancels the previous level run so a new level solve is not blocked', async () => {
    const levelRuntimeA = parseLevel({ id: 'level-a', name: 'Level A', rows: ['P'] });
    const levelRuntimeB = parseLevel({ id: 'level-b', name: 'Level B', rows: ['P'] });
    let firstRun = true;
    let firstRunId: string | null = null;
    let rejectFirstRun: ((reason?: unknown) => void) | null = null;
    const startSolveMock = vi.fn((request: Parameters<SolverPort['startSolve']>[0]) => {
      if (firstRun) {
        firstRun = false;
        firstRunId = request.runId;
        return new Promise<Awaited<ReturnType<SolverPort['startSolve']>>>((_resolve, reject) => {
          rejectFirstRun = reject;
        });
      }

      return Promise.resolve({
        runId: request.runId,
        algorithmId: request.algorithmId,
        status: 'unsolved' as const,
        metrics: {
          elapsedMs: 0,
          expanded: 0,
          generated: 0,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      });
    });
    const cancelSolveMock = vi.fn((runId: string) => {
      if (runId !== firstRunId || !rejectFirstRun) {
        return;
      }
      const cancelError = new Error('cancelled');
      cancelError.name = 'SolverRunCancelledError';
      rejectFirstRun(cancelError);
      rejectFirstRun = null;
    });
    const solverPort: SolverPort = {
      startSolve: startSolveMock,
      cancelSolve: cancelSolveMock,
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };
    const store = createAppStore({ solverPort });

    const runA = store.dispatch(startSolve({ levelRuntime: levelRuntimeA }));
    const activeRunId = store.getState().solver.activeRunId;
    expect(activeRunId).toBe(firstRunId);

    store.dispatch(nextLevel({ levelId: 'corgiban-test-22' }));
    store.dispatch(handleLevelChange(levelRuntimeB));

    expect(cancelSolveMock).toHaveBeenCalledWith(activeRunId);

    await runA;
    await store.dispatch(startSolve({ levelRuntime: levelRuntimeB }));

    expect(startSolveMock).toHaveBeenCalledTimes(2);

    store.dispose();
  });

  it('does nothing when cancelSolve is dispatched without an active run', () => {
    const solverPort: SolverPort = {
      ...noopSolverPort,
      cancelSolve: vi.fn(),
    };
    const dispatch = vi.fn();
    const getState = () => baseState();

    cancelSolve()(dispatch, getState, { solverPort });

    expect(dispatch).not.toHaveBeenCalled();
    expect(solverPort.cancelSolve).not.toHaveBeenCalled();
  });

  it('cancels the active run when cancelSolve is dispatched', () => {
    const solverPort: SolverPort = {
      startSolve: async () => {
        throw new Error('not used');
      },
      cancelSolve: vi.fn(),
      pingWorker: async () => undefined,
      retryWorker: () => undefined,
      getWorkerHealth: () => 'idle',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };
    const dispatch = vi.fn();
    const getState = () => ({
      ...baseState(),
      solver: {
        ...baseState().solver,
        activeRunId: 'run-123',
      },
    });

    cancelSolve()(dispatch, getState, { solverPort });

    expect(dispatch).toHaveBeenCalledWith(solveCancelRequested({ runId: 'run-123' }));
    expect(solverPort.cancelSolve).toHaveBeenCalledWith('run-123');
  });

  it('retries the worker and refreshes worker health', () => {
    const solverPort: SolverPort = {
      startSolve: async () => {
        throw new Error('not used');
      },
      cancelSolve: () => undefined,
      pingWorker: async () => undefined,
      retryWorker: vi.fn(),
      getWorkerHealth: () => 'healthy',
      subscribeWorkerHealth: () => () => undefined,
      dispose: () => undefined,
    };
    const dispatch = vi.fn();

    retryWorker()(dispatch, () => baseState(), { solverPort });

    expect(solverPort.retryWorker).toHaveBeenCalled();
    expect(dispatch.mock.calls[0]?.[0].type).toBe(workerRetried.type);
    expect(dispatch.mock.calls[1]?.[0]).toEqual(setWorkerHealth('healthy'));
  });
});
