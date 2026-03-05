import { describe, expect, it } from 'vitest';

import { DEFAULT_NODE_BUDGET, DEFAULT_SOLVER_TIME_BUDGET_MS } from '@corgiban/solver';

import {
  setDebug,
  setSolverNodeBudget,
  setSolverReplaySpeed,
  setSolverTimeBudgetMs,
  setTheme,
  setTileAnimationDuration,
  settingsSlice,
} from '../settingsSlice';

describe('settingsSlice', () => {
  it('returns the initial state', () => {
    const state = settingsSlice.reducer(undefined, { type: 'unknown' });

    expect(state.tileAnimationDuration).toBe(80);
    expect(state.solverReplaySpeed).toBe(1);
    expect(state.solverTimeBudgetMs).toBe(DEFAULT_SOLVER_TIME_BUDGET_MS);
    expect(state.solverNodeBudget).toBe(DEFAULT_NODE_BUDGET);
    expect(state.theme).toBe('light');
    expect(state.debug).toBe(false);
  });

  it('updates settings fields', () => {
    let state = settingsSlice.reducer(undefined, { type: 'unknown' });
    state = settingsSlice.reducer(state, setTileAnimationDuration(120));
    state = settingsSlice.reducer(state, setSolverReplaySpeed(1.5));
    state = settingsSlice.reducer(state, setSolverTimeBudgetMs(12_000));
    state = settingsSlice.reducer(state, setSolverNodeBudget(123_456));
    state = settingsSlice.reducer(state, setTheme('dark'));
    state = settingsSlice.reducer(state, setDebug(true));

    expect(state.tileAnimationDuration).toBe(120);
    expect(state.solverReplaySpeed).toBe(1.5);
    expect(state.solverTimeBudgetMs).toBe(12_000);
    expect(state.solverNodeBudget).toBe(123_456);
    expect(state.theme).toBe('dark');
    expect(state.debug).toBe(true);
  });

  it('keeps positive budget defaults when invalid values are dispatched', () => {
    let state = settingsSlice.reducer(undefined, { type: 'unknown' });
    state = settingsSlice.reducer(state, setSolverTimeBudgetMs(0));
    state = settingsSlice.reducer(state, setSolverNodeBudget(-1));

    expect(state.solverTimeBudgetMs).toBe(DEFAULT_SOLVER_TIME_BUDGET_MS);
    expect(state.solverNodeBudget).toBe(DEFAULT_NODE_BUDGET);
  });

  it('falls back for non-finite budgets and floors positive fractional values', () => {
    let state = settingsSlice.reducer(undefined, { type: 'unknown' });
    state = settingsSlice.reducer(state, setSolverTimeBudgetMs(Number.NaN));
    state = settingsSlice.reducer(state, setSolverNodeBudget(Number.POSITIVE_INFINITY));

    expect(state.solverTimeBudgetMs).toBe(DEFAULT_SOLVER_TIME_BUDGET_MS);
    expect(state.solverNodeBudget).toBe(DEFAULT_NODE_BUDGET);

    state = settingsSlice.reducer(state, setSolverTimeBudgetMs(0.5));
    state = settingsSlice.reducer(state, setSolverNodeBudget(42.9));

    expect(state.solverTimeBudgetMs).toBe(1);
    expect(state.solverNodeBudget).toBe(42);
  });
});
