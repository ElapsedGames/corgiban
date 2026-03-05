import { json, type LoaderFunctionArgs, type MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';

export const meta: MetaFunction = () => [{ title: '404 Not Found | Corgiban' }];

export function loader(_args: LoaderFunctionArgs) {
  return json({}, { status: 404 });
}

export default function NotFoundRoute() {
  return (
    <main className="page-shell">
      <h1 className="page-title">404 Not Found</h1>
      <p className="page-subtitle">The page you requested does not exist.</p>
      <section className="route-card">
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/play">
            Go to /play
          </Link>
        </div>
      </section>
    </main>
  );
}
