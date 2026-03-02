import { configureStore } from '@reduxjs/toolkit';

import { settingsSlice } from './settingsSlice';
import { solverSlice } from './solverSlice';

export const createAppStore = () =>
  configureStore({
    reducer: {
      settings: settingsSlice.reducer,
      solver: solverSlice.reducer,
    },
  });

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
