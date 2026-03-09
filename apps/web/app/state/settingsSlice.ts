import { createSlice } from '@reduxjs/toolkit';

import { DEFAULT_NODE_BUDGET, DEFAULT_SOLVER_TIME_BUDGET_MS } from '@corgiban/solver';

export type SettingsState = {
  tileAnimationDuration: number;
  solverReplaySpeed: number;
  solverTimeBudgetMs: number;
  solverNodeBudget: number;
  debug: boolean;
};

function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

const initialState: SettingsState = {
  tileAnimationDuration: 80,
  solverReplaySpeed: 1,
  solverTimeBudgetMs: DEFAULT_SOLVER_TIME_BUDGET_MS,
  solverNodeBudget: DEFAULT_NODE_BUDGET,
  debug: false,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTileAnimationDuration(state, action: { payload: number }) {
      state.tileAnimationDuration = action.payload;
    },
    setSolverReplaySpeed(state, action: { payload: number }) {
      state.solverReplaySpeed = action.payload;
    },
    setSolverTimeBudgetMs(state, action: { payload: number }) {
      state.solverTimeBudgetMs = toPositiveInt(action.payload, state.solverTimeBudgetMs);
    },
    setSolverNodeBudget(state, action: { payload: number }) {
      state.solverNodeBudget = toPositiveInt(action.payload, state.solverNodeBudget);
    },
    setDebug(state, action: { payload: boolean }) {
      state.debug = action.payload;
    },
  },
});

export const {
  setDebug,
  setSolverNodeBudget,
  setSolverReplaySpeed,
  setSolverTimeBudgetMs,
  setTileAnimationDuration,
} = settingsSlice.actions;
