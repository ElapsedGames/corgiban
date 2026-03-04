import { configureStore } from '@reduxjs/toolkit';
import type { Action, ThunkAction } from '@reduxjs/toolkit';

import { createNoopSolverPort } from '../ports/solverPort';
import type { SolverPort } from '../ports/solverPort';
import { gameSlice } from './gameSlice';
import { settingsSlice } from './settingsSlice';
import { setWorkerHealth, solverSlice } from './solverSlice';

export type ThunkExtra = {
  solverPort: SolverPort;
};

export type AppStoreOptions = {
  solverPort?: SolverPort;
};

export const createAppStore = (options: AppStoreOptions = {}) => {
  const solverPort = options.solverPort ?? createNoopSolverPort();

  const store = configureStore({
    reducer: {
      game: gameSlice.reducer,
      settings: settingsSlice.reducer,
      solver: solverSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument: {
            solverPort,
          } satisfies ThunkExtra,
        },
      }),
  });

  store.dispatch(setWorkerHealth(solverPort.getWorkerHealth()));
  const unsubscribeWorkerHealth = solverPort.subscribeWorkerHealth((health) => {
    store.dispatch(setWorkerHealth(health));
  });

  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    unsubscribeWorkerHealth();
    solverPort.dispose();
  };

  return Object.assign(store, { dispose });
};

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, ThunkExtra, Action>;
