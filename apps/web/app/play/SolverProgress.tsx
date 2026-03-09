import type { SolverProgressState, SolverResultState, SolverRunStatus } from '../state/solverSlice';

export type SolverProgressProps = {
  status: SolverRunStatus;
  progress: SolverProgressState | null;
  lastResult: SolverResultState | null;
  error: string | null;
};

function statusLabel(status: SolverRunStatus): string {
  switch (status) {
    case 'idle':
      return 'Idle';
    case 'running':
      return 'Running';
    case 'cancelling':
      return 'Cancelling';
    case 'succeeded':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

export function SolverProgress({ status, progress, lastResult, error }: SolverProgressProps) {
  return (
    <section
      aria-label="Solver status"
      className="space-y-3 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-3"
    >
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
        <span>Status</span>
        <span aria-live="polite" aria-atomic="true">
          {statusLabel(status)}
        </span>
      </div>

      {progress ? (
        <dl className="grid grid-cols-2 gap-2 text-xs text-[color:var(--color-muted)] sm:grid-cols-3">
          <div>
            <dt>Elapsed</dt>
            <dd className="text-sm font-semibold text-[color:var(--color-fg)]">
              {Math.round(progress.elapsedMs)} ms
            </dd>
          </div>
          <div>
            <dt>Expanded</dt>
            <dd className="text-sm font-semibold text-[color:var(--color-fg)]">
              {progress.expanded}
            </dd>
          </div>
          <div>
            <dt>Generated</dt>
            <dd className="text-sm font-semibold text-[color:var(--color-fg)]">
              {progress.generated}
            </dd>
          </div>
          <div>
            <dt>Depth</dt>
            <dd className="text-sm font-semibold text-[color:var(--color-fg)]">{progress.depth}</dd>
          </div>
          <div>
            <dt>Frontier</dt>
            <dd className="text-sm font-semibold text-[color:var(--color-fg)]">
              {progress.frontier}
            </dd>
          </div>
          {progress.bestHeuristic !== undefined ? (
            <div>
              <dt>Best heuristic</dt>
              <dd className="text-sm font-semibold text-[color:var(--color-fg)]">
                {progress.bestHeuristic}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {lastResult ? (
        <div className="rounded-[var(--radius-sm)] border border-[color:var(--color-border)] p-2 text-xs text-[color:var(--color-muted)]">
          <p className="font-semibold text-[color:var(--color-fg)]">
            Last result: {lastResult.status}
          </p>
          <p>
            Moves: {lastResult.metrics.moveCount} | Pushes: {lastResult.metrics.pushCount}
          </p>
          <p>
            Expanded: {lastResult.metrics.expanded} | Generated: {lastResult.metrics.generated}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="break-words text-xs font-semibold text-red-600 dark:text-red-300">{error}</p>
      ) : null}
    </section>
  );
}
