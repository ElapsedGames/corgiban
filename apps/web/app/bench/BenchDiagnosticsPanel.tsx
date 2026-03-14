import { useId } from 'react';

import type { BenchDiagnosticsState, BenchRunStatus } from '../state/benchSlice';
import { Tooltip } from '../ui/Tooltip';

export type BenchDiagnosticsPanelProps = {
  status: BenchRunStatus;
  progress: {
    totalRuns: number;
    completedRuns: number;
    latestResultId: string | null;
  };
  diagnostics: BenchDiagnosticsState;
};

type InfoLabelProps = {
  label: string;
  tooltip: string;
};

function InfoLabel({ label, tooltip }: InfoLabelProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <Tooltip content={tooltip}>
        <button
          type="button"
          aria-label={`${label} help`}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
        >
          i
        </button>
      </Tooltip>
    </span>
  );
}

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
        Track run progress and check whether this browser can save your benchmark history reliably.
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
          <dt className="shrink-0 text-muted">Latest result ID</dt>
          <dd
            className="max-w-[12rem] overflow-hidden text-ellipsis whitespace-nowrap text-right font-mono text-xs"
            title={progress.latestResultId ?? undefined}
          >
            {progress.latestResultId ?? 'None'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">
            <InfoLabel
              label="Browser storage permission"
              tooltip="This shows whether the browser agreed to keep saved benchmark data around instead of treating it as easy to remove later."
            />
          </dt>
          <dd>{diagnostics.persistOutcome ?? 'pending'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">
            <InfoLabel
              label="Save reliability"
              tooltip="This shows how safe your saved benchmark history is right now. Memory fallback means it only lasts until this page reloads."
            />
          </dt>
          <dd>{repositoryHealthLabel(diagnostics.repositoryHealth)}</dd>
        </div>
      </dl>

      {showMemoryFallbackNotice ? (
        <p className="mt-3 rounded-app-md border border-warning-border bg-warning-surface px-3 py-2 text-sm text-warning-text">
          Sticky memory-fallback means runs can still finish, but saved history is only available
          for this page session until you reload.
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
