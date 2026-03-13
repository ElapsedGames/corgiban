export type RequestedEntryPendingProps = {
  routeTitle: string;
  routeSubtitle: string;
  heading: string;
  message: string;
};

export function RequestedEntryPendingPage({
  routeTitle,
  routeSubtitle,
  heading,
  message,
}: RequestedEntryPendingProps) {
  return (
    <main id="main-content" className="page-shell play-shell">
      <header className="page-header">
        <h1 className="page-title">{routeTitle}</h1>
        <p className="page-subtitle">{routeSubtitle}</p>
      </header>

      <section className="route-card mt-6" aria-live="polite" aria-busy="true">
        <h2 className="text-lg font-semibold text-fg">{heading}</h2>
        <p className="mt-2 text-sm text-muted">{message}</p>
      </section>
    </main>
  );
}
