import { Link } from '@remix-run/react';

import { sharedVersion } from '@corgiban/shared';

export default function Index() {
  return (
    <main className="page-shell">
      <h1 className="page-title">Corgiban</h1>
      <p className="page-subtitle">Routing scaffold is ready for Phase 2.</p>
      <section className="route-card">
        <p className="text-sm text-[color:var(--color-muted)]">
          Shared package version: {sharedVersion}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/play">
            Go to /play
          </Link>
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/bench">
            Go to /bench
          </Link>
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/lab">
            Go to /lab
          </Link>
          <Link className="font-semibold text-[color:var(--color-accent)]" to="/dev/ui-kit">
            Go to /dev/ui-kit
          </Link>
        </div>
      </section>
    </main>
  );
}
