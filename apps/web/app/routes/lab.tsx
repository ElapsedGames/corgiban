import { isRouteErrorResponse, useRouteError } from '@remix-run/react';

import { LabPage } from '../lab/LabPage';

export default function LabRoute() {
  return <LabPage />;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="page-shell">
        <h1 className="page-title">Lab</h1>
        <p className="page-subtitle">
          {error.status} {error.statusText}
        </p>
      </main>
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <main className="page-shell">
      <h1 className="page-title">Lab</h1>
      <p className="page-subtitle">{message}</p>
    </main>
  );
}
