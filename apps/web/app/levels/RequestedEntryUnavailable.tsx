import { Link } from '@remix-run/react';

export type RequestedEntryUnavailableAction = {
  label: string;
  to: string;
};

export type RequestedEntryUnavailableProps = {
  routeTitle: string;
  routeSubtitle: string;
  heading: string;
  message: string;
  requestedIdentity: string;
  actions: RequestedEntryUnavailableAction[];
};

const actionClasses =
  'rounded px-2 py-1 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg';

export function RequestedEntryUnavailablePage({
  routeTitle,
  routeSubtitle,
  heading,
  message,
  requestedIdentity,
  actions,
}: RequestedEntryUnavailableProps) {
  return (
    <main id="main-content" className="page-shell play-shell">
      <header className="page-header">
        <h1 className="page-title">{routeTitle}</h1>
        <p className="page-subtitle">{routeSubtitle}</p>
      </header>

      <section className="route-card mt-6" aria-label={`${routeTitle} unavailable request`}>
        <h2 className="text-lg font-semibold text-fg">{heading}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <p className="mt-4 rounded-app-md border border-border bg-bg px-3 py-2 font-mono text-xs text-fg">
          Requested entry: {requestedIdentity}
        </p>
        <nav
          aria-label={`${routeTitle} recovery actions`}
          className="mt-4 flex flex-wrap gap-3 text-sm"
        >
          {actions.map((action) => (
            <Link key={`${action.label}:${action.to}`} className={actionClasses} to={action.to}>
              {action.label}
            </Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
