import { describe, expect, it } from 'vitest';

import {
  clearReplay,
  setRecommendation,
  setReplayIndex,
  setReplayState,
  setReplayTotalSteps,
  setSelectedAlgorithmId,
  setWorkerHealth,
  solveCancelRequested,
  solveRunCancelled,
  solveProgressReceived,
  solveRunCompleted,
  solveRunFailed,
  solveRunStarted,
  solverSlice,
  workerRetried,
} from '../solverSlice';

describe('solverSlice', () => {
  it('returns the initial state', () => {
    const state = solverSlice.reducer(undefined, { type: 'unknown' });

    expect(state.recommendation).toBeNull();
    expect(state.selectedAlgorithmId).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.activeRunId).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.workerHealth).toBe('idle');
    expect(state.lastResult).toBeNull();
    expect(state.error).toBeNull();
    expect(state.replayState).toBe('idle');
    expect(state.replayIndex).toBe(0);
    expect(state.replayTotalSteps).toBe(0);
  });

  it('stores recommendation and selected algorithm', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(
      state,
      setRecommendation({
        algorithmId: 'bfsPush',
        features: {
          width: 5,
          height: 5,
          boxCount: 2,
          walkableCount: 18,
          reachableCount: 15,
        },
      }),
    );
    state = solverSlice.reducer(state, setSelectedAlgorithmId('astarPush'));

    expect(state.recommendation?.algorithmId).toBe('bfsPush');
    expect(state.selectedAlgorithmId).toBe('astarPush');
  });

  it('tracks run lifecycle with progress and completion', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-1', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveProgressReceived({
        runId: 'run-1',
        progress: {
          runId: 'run-1',
          expanded: 10,
          generated: 12,
          depth: 3,
          frontier: 4,
          elapsedMs: 30,
        },
      }),
    );
    state = solverSlice.reducer(
      state,
      solveRunCompleted({
        runId: 'run-1',
        algorithmId: 'bfsPush',
        status: 'solved',
        solutionMoves: 'RR',
        metrics: {
          elapsedMs: 35,
          expanded: 10,
          generated: 12,
          maxDepth: 3,
          maxFrontier: 4,
          pushCount: 1,
          moveCount: 2,
        },
      }),
    );

    expect(state.status).toBe('succeeded');
    expect(state.activeRunId).toBeNull();
    expect(state.progress?.expanded).toBe(10);
    expect(state.lastResult?.status).toBe('solved');
    expect(state.error).toBeNull();
  });

  it('marks run as cancelling and then failed for active run', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-2', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveProgressReceived({
        runId: 'run-2',
        progress: {
          runId: 'run-2',
          expanded: 4,
          generated: 5,
          depth: 1,
          frontier: 2,
          elapsedMs: 8,
        },
      }),
    );
    state = solverSlice.reducer(state, solveCancelRequested({ runId: 'run-2' }));
    state = solverSlice.reducer(
      state,
      solveRunFailed({
        runId: 'run-2',
        message: 'Timed out',
      }),
    );

    expect(state.status).toBe('failed');
    expect(state.activeRunId).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.error).toBe('Timed out');
  });

  it('marks run as cancelled for active run id', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(
      state,
      solveRunStarted({ runId: 'run-cancel', algorithmId: 'bfsPush' }),
    );
    state = solverSlice.reducer(
      state,
      solveProgressReceived({
        runId: 'run-cancel',
        progress: {
          runId: 'run-cancel',
          expanded: 3,
          generated: 3,
          depth: 1,
          frontier: 1,
          elapsedMs: 4,
        },
      }),
    );
    state = solverSlice.reducer(state, solveCancelRequested({ runId: 'run-cancel' }));
    state = solverSlice.reducer(state, solveRunCancelled({ runId: 'run-cancel' }));

    expect(state.status).toBe('cancelled');
    expect(state.activeRunId).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.error).toBeNull();
  });

  it('ignores failure/progress for stale run ids', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-3', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveProgressReceived({
        runId: 'run-stale',
        progress: {
          runId: 'run-stale',
          expanded: 1,
          generated: 1,
          depth: 1,
          frontier: 1,
          elapsedMs: 1,
        },
      }),
    );
    state = solverSlice.reducer(state, solveCancelRequested({ runId: 'run-stale' }));
    state = solverSlice.reducer(
      state,
      solveRunFailed({
        runId: 'run-stale',
        message: 'stale failure',
      }),
    );
    state = solverSlice.reducer(
      state,
      solveRunCompleted({
        runId: 'run-stale',
        algorithmId: 'bfsPush',
        status: 'solved',
        solutionMoves: 'RR',
        metrics: {
          elapsedMs: 10,
          expanded: 2,
          generated: 3,
          maxDepth: 1,
          maxFrontier: 2,
          pushCount: 1,
          moveCount: 2,
        },
      }),
    );

    expect(state.status).toBe('running');
    expect(state.error).toBeNull();
    expect(state.progress).toBeNull();
    expect(state.lastResult).toBeNull();
  });

  it('transitions worker health to crashed and back to idle on retry', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-4', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveProgressReceived({
        runId: 'run-4',
        progress: {
          runId: 'run-4',
          expanded: 7,
          generated: 9,
          depth: 2,
          frontier: 3,
          elapsedMs: 15,
        },
      }),
    );
    state = solverSlice.reducer(state, setWorkerHealth('crashed'));

    expect(state.workerHealth).toBe('crashed');
    expect(state.status).toBe('failed');
    expect(state.progress).toBeNull();
    expect(state.error).toContain('crashed');

    state = solverSlice.reducer(state, workerRetried());
    expect(state.workerHealth).toBe('idle');
    expect(state.status).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('preserves lastResult when the worker crashes', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-5', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveRunCompleted({
        runId: 'run-5',
        algorithmId: 'bfsPush',
        status: 'solved',
        solutionMoves: 'RR',
        metrics: {
          elapsedMs: 20,
          expanded: 5,
          generated: 6,
          maxDepth: 2,
          maxFrontier: 3,
          pushCount: 1,
          moveCount: 2,
        },
      }),
    );

    const priorResult = state.lastResult;
    state = solverSlice.reducer(state, setWorkerHealth('crashed'));

    expect(state.lastResult).toEqual(priorResult);
    expect(state.status).toBe('failed');
  });

  it('marks error results as failed', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-6', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveRunCompleted({
        runId: 'run-6',
        algorithmId: 'bfsPush',
        status: 'error',
        errorMessage: 'Algorithm "astarPush" is not registered.',
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
    );

    expect(state.status).toBe('failed');
    expect(state.error).toBe('Algorithm "astarPush" is not registered.');
    expect(state.lastResult?.status).toBe('error');
  });

  it('marks cancelled results as cancelled', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, solveRunStarted({ runId: 'run-7', algorithmId: 'bfsPush' }));
    state = solverSlice.reducer(
      state,
      solveRunCompleted({
        runId: 'run-7',
        algorithmId: 'bfsPush',
        status: 'cancelled',
        metrics: {
          elapsedMs: 5,
          expanded: 2,
          generated: 3,
          maxDepth: 1,
          maxFrontier: 2,
          pushCount: 0,
          moveCount: 0,
        },
      }),
    );

    expect(state.status).toBe('cancelled');
    expect(state.error).toBeNull();
  });

  it('updates and clears replay state', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, setReplayTotalSteps(4));
    state = solverSlice.reducer(state, setReplayState('playing'));
    state = solverSlice.reducer(state, setReplayIndex(2));

    expect(state.replayTotalSteps).toBe(4);
    expect(state.replayState).toBe('playing');
    expect(state.replayIndex).toBe(2);

    state = solverSlice.reducer(state, clearReplay());

    expect(state.replayTotalSteps).toBe(0);
    expect(state.replayIndex).toBe(0);
    expect(state.replayState).toBe('idle');
  });
});
