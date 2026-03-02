import { describe, expect, it } from 'vitest';

import {
  clearReplay,
  setReplayIndex,
  setReplayState,
  setReplayTotalSteps,
  solverSlice,
} from '../solverSlice';

describe('solverSlice', () => {
  it('returns the initial state', () => {
    const state = solverSlice.reducer(undefined, { type: 'unknown' });

    expect(state.replayState).toBe('idle');
    expect(state.replayIndex).toBe(0);
    expect(state.replayTotalSteps).toBe(0);
  });

  it('sets replay total steps and resets replay index', () => {
    const initial = solverSlice.reducer(undefined, { type: 'unknown' });
    const next = solverSlice.reducer(initial, setReplayTotalSteps(2));

    expect(next.replayTotalSteps).toBe(2);
    expect(next.replayIndex).toBe(0);
  });

  it('updates replay metadata', () => {
    let state = solverSlice.reducer(undefined, { type: 'unknown' });
    state = solverSlice.reducer(state, setReplayState('playing'));
    state = solverSlice.reducer(state, setReplayIndex(3));

    expect(state.replayState).toBe('playing');
    expect(state.replayIndex).toBe(3);
  });

  it('clears replay state', () => {
    const initial = solverSlice.reducer(undefined, { type: 'unknown' });
    const populated = solverSlice.reducer(initial, setReplayTotalSteps(2));
    const playing = solverSlice.reducer(populated, setReplayState('playing'));
    const cleared = solverSlice.reducer(playing, clearReplay());

    expect(cleared.replayTotalSteps).toBe(0);
    expect(cleared.replayIndex).toBe(0);
    expect(cleared.replayState).toBe('idle');
  });
});
