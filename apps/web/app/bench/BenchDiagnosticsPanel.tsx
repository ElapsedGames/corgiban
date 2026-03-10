import { useId } from 'react';

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
  const headingId = useId();
  const showMemoryFallbackNotice = diagnostics.repositoryHealth === 'memory-fallback';
  const isActive = status === 'running' || status === 'cancelling';
  const progressMax = progress.totalRuns > 0 ? progress.totalRuns : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        Diagnostics
      </h2>
      <p className="mt-1 text-sm text-muted">
        Execution progress and persistence durability are tracked independently.
      </p>
      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Execution status</dt>
          <dd aria-live="polite" aria-atomic="true">
            {statusLabel(status)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Execution progress</dt>
          <dd
            role={isActive ? 'progressbar' : undefined}
            aria-valuenow={isActive ? progress.completedRuns : undefined}
            aria-valuemin={isActive ? 0 : undefined}
            aria-valuemax={isActive ? progressMax : undefined}
            aria-label={
              isActive
                ? `${progress.completedRuns} of ${progress.totalRuns} runs completed`
                : undefined
            }
          >
            {progress.completedRuns}/{progress.totalRuns}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="shrink-0 text-muted">Latest execution result</dt>
          <dd
            className="max-w-[12rem] overflow-hidden text-ellipsis whitespace-nowrap text-right font-mono text-xs"
            title={progress.latestResultId ?? undefined}
          >
            {progress.latestResultId ?? 'None'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Storage persistence</dt>
          <dd>{diagnostics.persistOutcome ?? 'pending'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">Persistence durability</dt>
          <dd>{repositoryHealthLabel(diagnostics.repositoryHealth)}</dd>
        </div>
      </dl>

      {showMemoryFallbackNotice ? (
        <p className="mt-3 rounded-app-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-text">
          Sticky memory-fallback means execution can still complete while durable persistence is
          degraded. Results stay in memory for the current page session until reload.
        </p>
      ) : null}

      <p
        role={diagnostics.lastError ? 'alert' : undefined}
        aria-live="assertive"
        aria-atomic="true"
        className={
          diagnostics.lastError
            ? 'mt-3 rounded-app-md border border-error-border bg-error-surface px-3 py-2 text-sm text-error-text'
            : 'sr-only'
        }
      >
        {diagnostics.lastError ?? ''}
      </p>

      <p
        aria-live="polite"
        aria-atomic="true"
        className={
          diagnostics.lastNotice
            ? 'mt-3 rounded-app-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-text'
            : 'sr-only'
        }
      >
        {diagnostics.lastNotice ?? ''}
      </p>
    </section>
  );
}
