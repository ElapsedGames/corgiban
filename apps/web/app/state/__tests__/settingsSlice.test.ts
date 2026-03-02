import { describe, expect, it } from 'vitest';

import {
  setDebug,
  setSolverReplaySpeed,
  setTheme,
  setTileAnimationDuration,
  settingsSlice,
} from '../settingsSlice';

describe('settingsSlice', () => {
  it('returns the initial state', () => {
    const state = settingsSlice.reducer(undefined, { type: 'unknown' });

    expect(state.tileAnimationDuration).toBe(80);
    expect(state.solverReplaySpeed).toBe(1);
    expect(state.theme).toBe('light');
    expect(state.debug).toBe(false);
  });

  it('updates settings fields', () => {
    let state = settingsSlice.reducer(undefined, { type: 'unknown' });
    state = settingsSlice.reducer(state, setTileAnimationDuration(120));
    state = settingsSlice.reducer(state, setSolverReplaySpeed(1.5));
    state = settingsSlice.reducer(state, setTheme('dark'));
    state = settingsSlice.reducer(state, setDebug(true));

    expect(state.tileAnimationDuration).toBe(120);
    expect(state.solverReplaySpeed).toBe(1.5);
    expect(state.theme).toBe('dark');
    expect(state.debug).toBe(true);
  });
});
