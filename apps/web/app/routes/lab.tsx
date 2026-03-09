import { isRouteErrorResponse, Link, useRouteError } from '@remix-run/react';

import { LabPage } from '../lab/LabPage';

export default function LabRoute() {
  return <LabPage />;
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
        <p className="text-sm text-[color:var(--color-muted)]">
          Return to a working page and try again.
        </p>
        <nav aria-label="Recovery links" className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            className="rounded px-2 py-1 font-semibold text-[color:var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            to="/"
          >
            Home
          </Link>
          <Link
            className="rounded px-2 py-1 font-semibold text-[color:var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            to="/lab"
          >
            Try Lab again
          </Link>
        </nav>
      </section>
    </main>
  );
}
