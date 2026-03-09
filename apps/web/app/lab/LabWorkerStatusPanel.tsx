import { useId } from 'react';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { statusText } from './labStatus';
import type { BenchState, SolveState } from './labTypes';

type LabWorkerStatusPanelProps = {
  solveState: SolveState;
  benchState: BenchState;
  onRunSolve: () => void;
  onCancelSolve: () => void;
  onApplySolution: () => void;
  onRunBench: () => void;
};

export function LabWorkerStatusPanel({
  solveState,
  benchState,
  onRunSolve,
  onCancelSolve,
  onApplySolution,
  onRunBench,
}: LabWorkerStatusPanelProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        One-click Worker Checks
      </h2>
      <p className="text-sm text-[color:var(--color-muted)]">
        Solve and benchmark runs execute through worker ports to keep the main thread responsive.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={onRunSolve}
          disabled={solveState.status === 'running'}
          aria-busy={solveState.status === 'running'}
        >
          {solveState.status === 'running' ? 'Solving...' : 'Run Solve'}
        </Button>
        <Button
          variant="secondary"
          onClick={onCancelSolve}
          disabled={solveState.status !== 'running'}
        >
          Cancel Solve
        </Button>
        <Button
          variant="secondary"
          onClick={onApplySolution}
          disabled={solveState.status !== 'completed' || !solveState.solutionMoves}
        >
          Apply Solution
        </Button>
        <Button
          onClick={onRunBench}
          disabled={benchState.status === 'running'}
          aria-busy={benchState.status === 'running'}
        >
          {benchState.status === 'running' ? 'Running Bench...' : 'Run Bench'}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3 text-sm">
          <h3 className="font-semibold">Solve status</h3>
          <p
            aria-live={
              solveState.status === 'failed' || solveState.status === 'cancelled'
                ? 'assertive'
                : 'polite'
            }
            role={
              solveState.status === 'failed' || solveState.status === 'cancelled'
                ? 'alert'
                : undefined
            }
            className="mt-1 break-all text-[color:var(--color-muted)]"
          >
            {statusText(solveState)}
          </p>
          {solveState.status === 'running' ? (
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              {`expanded=${solveState.expanded} generated=${solveState.generated} elapsed=${solveState.elapsedMs.toFixed(1)} ms`}
            </p>
          ) : null}
          {solveState.status === 'completed' && solveState.solutionMoves ? (
            <div className="mt-2">
              <Input
                label="Solution (read only)"
                hint="Copy this string to use the solution elsewhere."
                readOnly
                aria-readonly="true"
                value={solveState.solutionMoves}
                autoFocus
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3 text-sm">
          <h3 className="font-semibold">Bench status</h3>
          <p
            aria-live={
              benchState.status === 'failed' || benchState.status === 'cancelled'
                ? 'assertive'
                : 'polite'
            }
            role={
              benchState.status === 'failed' || benchState.status === 'cancelled'
                ? 'alert'
                : undefined
            }
            className="mt-1 break-all text-[color:var(--color-muted)]"
          >
            {statusText(benchState)}
          </p>
          {benchState.status === 'completed' ? (
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              {`runId=${benchState.runId} expanded=${benchState.expanded} generated=${benchState.generated}`}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
