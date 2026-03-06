import type { BenchDiagnosticsState, BenchRunStatus } from '../state/benchSlice';

export type BenchDiagnosticsPanelProps = {
  status: BenchRunStatus;
  progress: {
    totalRuns: number;
    completedRuns: number;
    latestResultId: string | null;
  };
  diagnostics: BenchDiagnosticsState;
};

function statusLabel(status: BenchRunStatus): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'cancelling':
      return 'Cancelling';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return 'Idle';
  }
}

function repositoryHealthLabel(
  health: BenchDiagnosticsPanelProps['diagnostics']['repositoryHealth'],
): string {
  if (health === 'memory-fallback') {
    return 'memory-fallback (sticky until reload)';
  }
  return health ?? 'pending';
}

export function BenchDiagnosticsPanel({
  status,
  progress,
  diagnostics,
}: BenchDiagnosticsPanelProps) {
  const showMemoryFallbackNotice = diagnostics.repositoryHealth === 'memory-fallback';

  return (
    <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg">
      <h2 className="text-lg font-semibold">Diagnostics</h2>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
        Execution progress and persistence durability are tracked independently.
      </p>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[color:var(--color-muted)]">Execution status</dt>
          <dd>{statusLabel(status)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[color:var(--color-muted)]">Execution progress</dt>
          <dd>
            {progress.completedRuns}/{progress.totalRuns}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[color:var(--color-muted)]">Latest execution result</dt>
          <dd>{progress.latestResultId ?? 'None'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[color:var(--color-muted)]">Storage persistence</dt>
          <dd>{diagnostics.persistOutcome ?? 'pending'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[color:var(--color-muted)]">Persistence durability</dt>
          <dd>{repositoryHealthLabel(diagnostics.repositoryHealth)}</dd>
        </div>
      </dl>

      {showMemoryFallbackNotice ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Sticky memory-fallback means execution can still complete while durable persistence is
          degraded. Results stay in memory for the current page session until reload.
        </p>
      ) : null}

      {diagnostics.lastError ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {diagnostics.lastError}
        </p>
      ) : null}

      {diagnostics.lastNotice ? (
        <p className="mt-3 rounded-[var(--radius-md)] border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {diagnostics.lastNotice}
        </p>
      ) : null}
    </section>
  );
}
