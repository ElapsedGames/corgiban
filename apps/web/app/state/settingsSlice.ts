import { createSlice } from '@reduxjs/toolkit';

export type ThemeMode = 'light' | 'dark';

export type SettingsState = {
  tileAnimationDuration: number;
  solverReplaySpeed: number;
  theme: ThemeMode;
  debug: boolean;
};

const initialState: SettingsState = {
  tileAnimationDuration: 80,
  solverReplaySpeed: 1,
  theme: 'light',
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
    setTheme(state, action: { payload: ThemeMode }) {
      state.theme = action.payload;
    },
    setDebug(state, action: { payload: boolean }) {
      state.debug = action.payload;
    },
  },
});

export const { setTileAnimationDuration, setSolverReplaySpeed, setTheme, setDebug } =
  settingsSlice.actions;
