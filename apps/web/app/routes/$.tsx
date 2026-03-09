import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Link, useLocation } from '@remix-run/react';

export const meta: MetaFunction = () => [{ title: '404 Not Found | Corgiban' }];

export function loader(_args: LoaderFunctionArgs) {
  return json({}, { status: 404 });
}

export default function NotFoundRoute() {
  const { pathname } = useLocation();
  return (
    <main id="main-content" className="page-shell">
      <h1 className="page-title">404 Not Found</h1>
      <p className="page-subtitle">
        <code className="break-all font-mono text-[color:var(--color-accent)]">{pathname}</code>{' '}
        does not exist.
      </p>
      <section className="route-card" aria-label="Return navigation">
        <p className="text-sm text-[color:var(--color-muted)]">
          You can navigate to one of these pages instead:
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
            to="/play"
          >
            Play
          </Link>
        </nav>
      </section>
    </main>
  );
}
