import { Link, isRouteErrorResponse, useRouteError } from '@remix-run/react';

export default function BenchRoute() {
  return (
    <main className="page-shell">
      <h1 className="page-title">Bench</h1>
      <p className="page-subtitle">
        Benchmark tooling and persistence will live here once Phase 4 arrives.
      </p>
      <section className="route-card">
        <h2 className="text-xl font-semibold">Placeholder</h2>
        <p className="mt-2 text-sm text-[color:var(--color-muted)]">
          Solver and benchmark wiring is deferred. Use /play for the primary experience.
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/play">
            Back to /play
          </Link>
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/dev/ui-kit">
            Visit /dev/ui-kit
          </Link>
        </div>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <main className="page-shell">
        <h1 className="page-title">Bench</h1>
        <p className="page-subtitle">
          {error.status} {error.statusText}
        </p>
      </main>
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';

  return (
    <main className="page-shell">
      <h1 className="page-title">Bench</h1>
      <p className="page-subtitle">{message}</p>
    </main>
  );
}
