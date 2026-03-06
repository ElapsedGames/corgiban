import { useEffect, useLayoutEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from '@remix-run/react';
import { Provider } from 'react-redux';

import type { AppStore } from '../state';
import { createAppStore } from '../state';
import { PlayPage } from '../play/PlayPage';
import { createNoopSolverPort } from '../ports/solverPort';
import { createSolverPort } from '../ports/solverPort.client';
import { createMutableSolverPort, type MutableSolverPort } from '../state/mutableDependencies';

const useRouteStoreEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

type PlayRouteStoreOwner = {
  solverPort: MutableSolverPort;
  store: AppStore;
};

function createPlayRouteStoreOwner(): PlayRouteStoreOwner {
  const solverPort = createMutableSolverPort();
  return {
    solverPort,
    store: createAppStore({ solverPort }),
  };
}

export default function PlayRoute() {
  const [storeOwner] = useState(createPlayRouteStoreOwner);

  useRouteStoreEffect(() => {
    if (typeof document !== 'undefined') {
      storeOwner.solverPort.replace(createSolverPort());
    }

    return () => {
      storeOwner.solverPort.replace(createNoopSolverPort());
    };
  }, [storeOwner]);

  return (
    <Provider store={storeOwner.store}>
      <PlayPage />
    </Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="page-shell">
        <h1 className="page-title">Play</h1>
        <p className="page-subtitle">
          {error.status} {error.statusText}
        </p>
      </main>
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <main className="page-shell">
      <h1 className="page-title">Play</h1>
      <p className="page-subtitle">{message}</p>
    </main>
  );
}
