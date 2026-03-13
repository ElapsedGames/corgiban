import { isRouteErrorResponse, Link, useRouteError, useSearchParams } from '@remix-run/react';

import { RequestedEntryPendingPage } from '../levels/RequestedEntryPending';
import { RequestedEntryUnavailablePage } from '../levels/RequestedEntryUnavailable';
import { buildLabHref } from '../navigation/handoffLinks';
import { isBuiltinLevelId } from '../levels/temporaryLevelCatalog';
import { useRequestedPlayableEntryResolution } from '../levels/usePlayableLevels';
import { LabPage } from '../lab/LabPage';

export default function LabRoute() {
  const [searchParams] = useSearchParams();
  const requestedLevelId = searchParams.get('levelId');
  const requestedLevelRef = searchParams.get('levelRef');
  const requestedExactLevelKey = searchParams.get('exactLevelKey');
  const requestedEntryResolution = useRequestedPlayableEntryResolution({
    levelId: requestedLevelId,
    levelRef: requestedLevelRef,
    exactLevelKey: requestedExactLevelKey,
  });

  if (requestedEntryResolution.status === 'pendingClientCatalog') {
    return (
      <RequestedEntryPendingPage
        routeTitle="Level Lab"
        routeSubtitle="Edit and inspect exact playable levels here. Session-backed handoffs restore after the browser catalog hydrates."
        heading="Restoring session source"
        message="This Lab handoff depends on browser-session level data that is not available during server render. The route will resume once the client catalog loads."
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
              to: buildLabHref({ levelId: requestedEntryResolution.fallbackLevelId }),
            },
          ]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Level Lab"
        routeSubtitle="Edit and inspect exact playable levels here. Missing handoff targets fail closed instead of dropping into a starter draft."
        heading="Requested session source is unavailable"
        message="The exact session-backed level for this Lab handoff is no longer available, so the editor will not replace it with a different draft."
        requestedIdentity={requestedEntryResolution.requestedRef}
        actions={[
          ...fallbackActions,
          { label: 'Open Lab', to: '/lab' },
          { label: 'Open Play', to: '/play' },
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
              to: buildLabHref({ levelId: requestedEntryResolution.fallbackLevelId }),
            },
          ]
        : [];

    return (
      <RequestedEntryUnavailablePage
        routeTitle="Level Lab"
        routeSubtitle="Edit and inspect exact playable levels here. Missing handoff targets fail closed instead of dropping into a starter draft."
        heading="Requested level version is unavailable"
        message="The exact playable version for this Lab handoff is no longer available, so the editor will not replace it with a different draft."
        requestedIdentity={
          requestedEntryResolution.requestedRef ??
          requestedEntryResolution.requestedLevelId ??
          requestedEntryResolution.requestedExactLevelKey
        }
        actions={[
          ...fallbackActions,
          { label: 'Open Lab', to: '/lab' },
          { label: 'Open Play', to: '/play' },
        ]}
      />
    );
  }

  if (requestedEntryResolution.status === 'missingLevelId') {
    return (
      <RequestedEntryUnavailablePage
        routeTitle="Level Lab"
        routeSubtitle="Edit and inspect exact playable levels here. Missing handoff targets fail closed instead of dropping into a starter draft."
        heading="Requested level is unavailable"
        message="This link requested a level id that is not available in the current playable catalog."
        requestedIdentity={requestedEntryResolution.requestedLevelId}
        actions={[
          { label: 'Open Lab', to: '/lab' },
          { label: 'Open Play', to: '/play' },
          { label: 'Open Bench', to: '/bench' },
        ]}
      />
    );
  }

  const initialPlayable =
    requestedEntryResolution.status === 'resolved' ? requestedEntryResolution.entry : undefined;

  return (
    <LabPage
      key={`${searchParams.toString()}:${initialPlayable?.ref ?? 'unresolved'}`}
      initialPlayable={initialPlayable ?? undefined}
    />
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isHttp = isRouteErrorResponse(error);
  const heading = isHttp ? `Error ${error.status}` : 'Something went wrong';
  const message = isHttp
    ? error.statusText || `HTTP ${error.status}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <main id="main-content" className="page-shell">
      <h1 className="page-title">{heading}</h1>
      <p className="page-subtitle">{message}</p>
      <section className="route-card" aria-label="Recovery navigation">
        <p className="text-sm text-muted">Return to a working page and try again.</p>
        <nav aria-label="Recovery links" className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            className="rounded px-2 py-1 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            to="/"
          >
            Home
          </Link>
          <Link
            className="rounded px-2 py-1 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            to="/lab"
          >
            Try Lab again
          </Link>
        </nav>
      </section>
    </main>
  );
}
