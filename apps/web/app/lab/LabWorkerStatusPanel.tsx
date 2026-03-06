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
  return (
    <div className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg">
      <h2 className="text-lg font-semibold">One-click Worker Checks</h2>
      <p className="text-sm text-[color:var(--color-muted)]">
        Solve and benchmark runs execute through worker ports to keep the main thread responsive.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={onRunSolve} disabled={solveState.status === 'running'}>
          Run solve
        </Button>
        <Button
          variant="secondary"
          onClick={onCancelSolve}
          disabled={solveState.status !== 'running'}
        >
          Cancel solve
        </Button>
        <Button
          variant="secondary"
          onClick={onApplySolution}
          disabled={solveState.status !== 'completed' || !solveState.solutionMoves}
        >
          Apply solution
        </Button>
        <Button onClick={onRunBench} disabled={benchState.status === 'running'}>
          Run bench
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3 text-sm">
          <h3 className="font-semibold">Solve status</h3>
          <p className="mt-1 text-[color:var(--color-muted)]">{statusText(solveState)}</p>
          {solveState.status === 'running' ? (
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              expanded={solveState.expanded} generated={solveState.generated} elapsed=
              {solveState.elapsedMs.toFixed(1)} ms
            </p>
          ) : null}
          {solveState.status === 'completed' && solveState.solutionMoves ? (
            <Input label="Solution" readOnly value={solveState.solutionMoves} />
          ) : null}
        </div>

        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3 text-sm">
          <h3 className="font-semibold">Bench status</h3>
          <p className="mt-1 text-[color:var(--color-muted)]">{statusText(benchState)}</p>
          {benchState.status === 'completed' ? (
            <p className="mt-1 text-xs text-[color:var(--color-muted)]">
              runId={benchState.runId} expanded={benchState.expanded} generated=
              {benchState.generated}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
