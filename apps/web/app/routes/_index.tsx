import type { ServerRuntimeMetaFunction as MetaFunction } from '@remix-run/server-runtime';
import { Link } from '@remix-run/react';

import { sharedVersion } from '@corgiban/shared';

export const meta: MetaFunction = () => [{ title: 'Corgiban' }];

export default function Index() {
  return (
    <main id="main-content" className="page-shell">
      <header className="page-header">
        <h1 className="page-title">Corgiban</h1>
        <p className="page-subtitle">
          Deterministic Sokoban play, solver benchmarking, and level authoring in one workspace.
        </p>
      </header>

      <section className="route-card" aria-label="Main workflows">
        <p className="text-sm text-[color:var(--color-muted)]">
          Shared package version: {sharedVersion}
        </p>
        <nav aria-label="App routes" className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            className="rounded px-2 py-1 font-semibold text-[color:var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            to="/play"
          >
            Play
          </Link>
          <Link
            className="rounded px-2 py-1 font-semibold text-[color:var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            to="/bench"
          >
            Benchmark
          </Link>
          <Link
            className="rounded px-2 py-1 font-semibold text-[color:var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
            to="/lab"
          >
            Lab
          </Link>
        </nav>
      </section>
    </main>
  );
}
