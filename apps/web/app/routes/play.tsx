import { useEffect, useLayoutEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError, useSearchParams } from '@remix-run/react';
import { Provider } from 'react-redux';

import type { AlgorithmId } from '@corgiban/solver';

import { RequestedEntryPendingPage } from '../levels/RequestedEntryPending';
import { RequestedEntryUnavailablePage } from '../levels/RequestedEntryUnavailable';
import { isBuiltinLevelId } from '../levels/temporaryLevelCatalog';
import { useRequestedPlayableEntryResolution } from '../levels/usePlayableLevels';
import { buildPlayHref } from '../navigation/handoffLinks';
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
  const [searchParams] = useSearchParams();
  const requestedLevelId = searchParams.get('levelId');
  const requestedLevelRef = searchParams.get('levelRef');
  const requestedExactLevelKey = searchParams.get('exactLevelKey');
  const requestedAlgorithmId = searchParams.get('algorithmId') as AlgorithmId | null;
  const requestedEntryResolution = useRequestedPlayableEntryResolution({
    levelId: requestedLevelId,
    levelRef: requestedLevelRef,
    exactLevelKey: requestedExactLevelKey,
  });
  const hasUnavailableRequest =
    requestedEntryResolution.status === 'missingExactRef' ||
    requestedEntryResolution.status === 'missingExactKey' ||
    requestedEntryResolution.status === 'missingLevelId';

  useRouteStoreEffect(() => {
    if (hasUnavailableRequest) {
      return () => {
        storeOwner.solverPort.replace(createNoopSolverPort());
      };
    }

    if (typeof document !== 'undefined') {
      storeOwner.solverPort.replace(createSolverPort());
    }

    return () => {
      storeOwner.solverPort.replace(createNoopSolverPort());
    };
  }, [hasUnavailableRequest, storeOwner]);

  if (requestedEntryResolution.status === 'pendingClientCatalog') {
    return (
      <RequestedEntryPendingPage
        routeTitle="Play"
        routeSubtitle="Open exact session-scoped levels here. Session-backed handoffs restore after the browser catalog hydrates."
        heading="Restoring session level"
        message="This play handoff depends on browser-session level data that is not available during server render. The route will resume once the client catalog loads."
      />
    );
  }

  if (requestedEntryResolution.status === 'missingExactRef') {
    const fallbackActions =
      requestedEntryResolution.fallbackLevelId &&
      isBuiltinLevelId(requestedEntryResolution.fallbackLevelId)
        ? [
            {
              label: 'Open Built-In',
              to: buildPlayHref(
                { levelId: requestedEntryResolution.fallbackLevelId },
                requestedAlgorithmId ?? undefined,
              ),
            },
          ]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Play"
        routeSubtitle="Open exact session-scoped levels here. Missing handoff targets fail closed instead of loading a different puzzle."
        heading="Requested session level is unavailable"
        message="The exact playable entry from this link is no longer available in the current browser session."
        requestedIdentity={requestedEntryResolution.requestedRef}
        actions={[
          ...fallbackActions,
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  if (requestedEntryResolution.status === 'missingExactKey') {
    const fallbackActions =
      requestedEntryResolution.fallbackLevelId &&
      isBuiltinLevelId(requestedEntryResolution.fallbackLevelId)
        ? [
            {
              label: 'Open Built-In',
              to: buildPlayHref(
                { levelId: requestedEntryResolution.fallbackLevelId },
                requestedAlgorithmId ?? undefined,
              ),
            },
          ]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Play"
        routeSubtitle="Open exact session-scoped levels here. Missing handoff targets fail closed instead of loading a different puzzle."
        heading="Requested level version is unavailable"
        message="The exact playable version from this link is no longer available in the current browser session."
        requestedIdentity={
          requestedEntryResolution.requestedRef ??
          requestedEntryResolution.requestedLevelId ??
          requestedEntryResolution.requestedExactLevelKey
        }
        actions={[
          ...fallbackActions,
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  if (requestedEntryResolution.status === 'missingLevelId') {
    return (
      <RequestedEntryUnavailablePage
        routeTitle="Play"
        routeSubtitle="Open exact session-scoped levels here. Missing handoff targets fail closed instead of loading a different puzzle."
        heading="Requested level is unavailable"
        message="This link requested a level id that is not available in the current catalog."
        requestedIdentity={requestedEntryResolution.requestedLevelId}
        actions={[
          { label: 'Open Play', to: '/play' },
          { label: 'Open Bench', to: '/bench' },
          { label: 'Open Lab', to: '/lab' },
        ]}
      />
    );
  }

  return (
    <Provider store={storeOwner.store}>
      <PlayPage
        requestedLevelId={requestedLevelId}
        requestedLevelRef={requestedLevelRef}
        requestedExactLevelKey={requestedExactLevelKey}
        requestedAlgorithmId={requestedAlgorithmId}
      />
    </Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main id="main-content" className="page-shell" aria-label="Play error">
        <h1 className="page-title">Play</h1>
        <p className="page-subtitle">
          {error.status} {error.statusText}
        </p>
      </main>
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <main id="main-content" className="page-shell" aria-label="Play error">
      <h1 className="page-title">Play</h1>
      <p className="page-subtitle">{message}</p>
    </main>
  );
}
