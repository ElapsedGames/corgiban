import { useEffect, useRef } from 'react';
import { isRouteErrorResponse, useRouteError } from '@remix-run/react';
import { Provider } from 'react-redux';

import type { AppStore } from '../state';
import { createAppStore } from '../state';
import { createSolverPort } from '../ports/solverPort.client';
import { createNoopSolverPort } from '../ports/solverPort';
import { PlayPage } from '../play/PlayPage';

export default function PlayRoute() {
  const storeRef = useRef<AppStore>();
  if (!storeRef.current) {
    const solverPort =
      typeof document === 'undefined' ? createNoopSolverPort() : createSolverPort();
    storeRef.current = createAppStore({ solverPort });
  }

  useEffect(() => {
    return () => {
      storeRef.current?.dispose();
      storeRef.current = undefined;
    };
  }, []);

  return (
    <Provider store={storeRef.current}>
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
