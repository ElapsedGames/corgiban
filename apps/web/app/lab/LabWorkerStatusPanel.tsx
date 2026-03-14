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
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        Quick Worker Checks
      </h2>
      <p className="text-sm text-muted">
        Use these after a successful parse. Solve checks that the level can be completed, and Bench
        gives you one measured run you can compare later in the full Bench page.
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
          variant="tonal"
          onClick={onApplySolution}
          disabled={solveState.status !== 'completed' || !solveState.solutionMoves}
        >
          Apply Solution
        </Button>
        <Button
          variant="secondary"
          onClick={onRunBench}
          disabled={benchState.status === 'running'}
          aria-busy={benchState.status === 'running'}
        >
          {benchState.status === 'running' ? 'Running Bench...' : 'Run Bench'}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-app-md border border-border p-3 text-sm">
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
            className="mt-1 break-all text-muted"
          >
            {statusText(solveState)}
          </p>
          {solveState.status === 'running' ? (
            <p className="mt-1 text-xs text-muted">
              Expanded: {solveState.expanded} | Generated: {solveState.generated} | Elapsed:{' '}
              {solveState.elapsedMs.toFixed(1)} ms
            </p>
          ) : null}
          {solveState.status === 'completed' && solveState.solutionMoves ? (
            <div className="mt-2">
              <Input
                label="Solution (read only)"
                annotation="Copy this move string to reuse the solution somewhere else."
                readOnly
                aria-readonly="true"
                value={solveState.solutionMoves}
                autoFocus
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-app-md border border-border p-3 text-sm">
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
            className="mt-1 break-all text-muted"
          >
            {statusText(benchState)}
          </p>
          {benchState.status === 'completed' ? (
            <p className="mt-1 text-xs text-muted">
              Run ID: {benchState.runId} | Expanded: {benchState.expanded} | Generated:{' '}
              {benchState.generated}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
