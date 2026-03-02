import { createSlice } from '@reduxjs/toolkit';

export type ReplayState = 'idle' | 'playing' | 'paused' | 'done';

export type SolverSliceState = {
  replayState: ReplayState;
  replayIndex: number;
  replayTotalSteps: number;
};

const initialState: SolverSliceState = {
  replayState: 'idle',
  replayIndex: 0,
  replayTotalSteps: 0,
};

export const solverSlice = createSlice({
  name: 'solver',
  initialState,
  reducers: {
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

export const { setReplayTotalSteps, setReplayState, setReplayIndex, clearReplay } =
  solverSlice.actions;
