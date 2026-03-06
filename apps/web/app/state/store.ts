import { configureStore } from '@reduxjs/toolkit';
import type { Action, ThunkAction } from '@reduxjs/toolkit';

import { createNoopBenchmarkPort } from '../ports/benchmarkPort';
import type { BenchmarkPort } from '../ports/benchmarkPort';
import { createNoopPersistencePort, type PersistencePort } from '../ports/persistencePort';
import { createNoopSolverPort } from '../ports/solverPort';
import type { SolverPort } from '../ports/solverPort';
import { benchSlice } from './benchSlice';
import { gameSlice } from './gameSlice';
import { settingsSlice } from './settingsSlice';
import { setWorkerHealth, solverSlice } from './solverSlice';

export type ThunkExtra = {
  solverPort: SolverPort;
  benchmarkPort?: BenchmarkPort;
  persistencePort?: PersistencePort;
};

export type AppStoreOptions = {
  solverPort?: SolverPort;
  benchmarkPort?: BenchmarkPort;
  persistencePort?: PersistencePort;
};

export const createAppStore = (options: AppStoreOptions = {}) => {
  // Route components own real browser resources and attach them after commit.
  const solverPort = options.solverPort ?? createNoopSolverPort();
  const benchmarkPort = options.benchmarkPort ?? createNoopBenchmarkPort();
  const persistencePort = options.persistencePort ?? createNoopPersistencePort();

  const store = configureStore({
    reducer: {
      bench: benchSlice.reducer,
      game: gameSlice.reducer,
      settings: settingsSlice.reducer,
      solver: solverSlice.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: {
          extraArgument: {
            solverPort,
            benchmarkPort,
            persistencePort,
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
    benchmarkPort.dispose();
    persistencePort.dispose();
  };

  return Object.assign(store, { dispose });
};

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, ThunkExtra, Action>;
