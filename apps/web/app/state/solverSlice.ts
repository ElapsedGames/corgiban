import { createSlice } from '@reduxjs/toolkit';

import type { AlgorithmId, LevelFeatures, SolveStatus, SolverMetrics } from '@corgiban/solver';

import type { SolverProgress, SolverRunResult, WorkerHealth } from '../ports/solverPort';

export type ReplayState = 'idle' | 'playing' | 'paused' | 'done';

export type SolverRunStatus =
  | 'idle'
  | 'running'
  | 'cancelling'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type SolverRecommendation = {
  algorithmId: AlgorithmId;
  features: LevelFeatures;
};

export type SolverProgressState = SolverProgress;

export type SolverResultState = {
  runId: string;
  algorithmId: AlgorithmId;
  status: SolveStatus;
  solutionMoves?: string;
  errorMessage?: string;
  errorDetails?: string;
  metrics: SolverMetrics;
};

export type SolverSliceState = {
  recommendation: SolverRecommendation | null;
  selectedAlgorithmId: AlgorithmId | null;
  status: SolverRunStatus;
  activeRunId: string | null;
  progress: SolverProgressState | null;
  workerHealth: WorkerHealth;
  lastResult: SolverResultState | null;
  error: string | null;
  replayState: ReplayState;
  replayIndex: number;
  replayTotalSteps: number;
};

const initialState: SolverSliceState = {
  recommendation: null,
  selectedAlgorithmId: null,
  status: 'idle',
  activeRunId: null,
  progress: null,
  workerHealth: 'idle',
  lastResult: null,
  error: null,
  replayState: 'idle',
  replayIndex: 0,
  replayTotalSteps: 0,
};

export const solverSlice = createSlice({
  name: 'solver',
  initialState,
  reducers: {
    setRecommendation(state, action: { payload: SolverRecommendation }) {
      state.recommendation = action.payload;
    },
    setSelectedAlgorithmId(state, action: { payload: AlgorithmId }) {
      state.selectedAlgorithmId = action.payload;
    },
    resetSolverRunState(state) {
      state.status = 'idle';
      state.activeRunId = null;
      state.progress = null;
      state.lastResult = null;
      state.error = null;
      state.replayState = 'idle';
      state.replayIndex = 0;
      state.replayTotalSteps = 0;
    },
    solveRunStarted(state, action: { payload: { runId: string; algorithmId: AlgorithmId } }) {
      state.status = 'running';
      state.activeRunId = action.payload.runId;
      state.selectedAlgorithmId = action.payload.algorithmId;
      state.progress = null;
      state.error = null;
    },
    solveProgressReceived(
      state,
      action: { payload: { runId: string; progress: SolverProgressState } },
    ) {
      if (state.activeRunId !== action.payload.runId) {
        return;
      }
      state.progress = action.payload.progress;
    },
    solveCancelRequested(state, action: { payload: { runId: string } }) {
      if (state.activeRunId !== action.payload.runId) {
        return;
      }
      state.status = 'cancelling';
    },
    solveRunCancelled(state, action: { payload: { runId: string } }) {
      if (state.activeRunId !== action.payload.runId) {
        return;
      }
      state.status = 'cancelled';
      state.activeRunId = null;
      state.progress = null;
      state.error = null;
    },
    solveRunCompleted(state, action: { payload: SolverResultState }) {
      const result = action.payload;
      if (state.activeRunId !== result.runId) {
        return;
      }
      state.activeRunId = null;
      state.lastResult = result;
      state.error = null;

      if (result.status === 'cancelled') {
        state.status = 'cancelled';
      } else if (result.status === 'error') {
        state.status = 'failed';
        state.error = result.errorMessage ?? 'Solver reported an error.';
      } else {
        state.status = 'succeeded';
      }
    },
    solveRunFailed(state, action: { payload: { runId: string; message: string } }) {
      if (state.activeRunId !== action.payload.runId) {
        return;
      }
      state.status = 'failed';
      state.activeRunId = null;
      state.progress = null;
      state.error = action.payload.message;
    },
    setWorkerHealth(state, action: { payload: WorkerHealth }) {
      state.workerHealth = action.payload;
      if (action.payload === 'crashed') {
        state.status = 'failed';
        state.activeRunId = null;
        state.progress = null;
        state.error = 'Solver worker crashed.';
      }
    },
    workerRetried(state) {
      state.workerHealth = 'idle';
      state.status = 'idle';
      state.activeRunId = null;
      state.progress = null;
      state.error = null;
    },
    setReplayTotalSteps(state, action: { payload: number }) {
      state.replayTotalSteps = action.payload;
      state.replayIndex = 0;
    },
    setReplayState(state, action: { payload: ReplayState }) {
      state.replayState = action.payload;
    },
    setReplayIndex(state, action: { payload: number }) {
      state.replayIndex = action.payload;
    },
    clearReplay(state) {
      state.replayTotalSteps = 0;
      state.replayIndex = 0;
      state.replayState = 'idle';
    },
  },
});

export const {
  clearReplay,
  resetSolverRunState,
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
  workerRetried,
} = solverSlice.actions;
