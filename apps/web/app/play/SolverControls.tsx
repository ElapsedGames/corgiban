import type { WorkerHealth } from '../ports/solverPort';
import type { ReplayState, SolverRunStatus } from '../state/solverSlice';
import { Button } from '../ui/Button';

export const REPLAY_SPEED_OPTIONS = [
  { value: 0.25, label: '0.25x' },
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 4, label: '4x' },
] as const;

export const inlineSelectClass =
  'rounded-app-md border border-border bg-panel px-2 py-1 text-xs text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg';

export type SolverControlsProps = {
  status: SolverRunStatus;
  replayState: ReplayState;
  workerHealth: WorkerHealth;
  hasSolution: boolean;
  replayIndex: number;
  replayTotalSteps: number;
  replaySpeed: number;
  onRun: () => void;
  onCancel: () => void;
  onApply: () => void;
  onAnimate: () => void;
  onReplayPlayPause: () => void;
  onReplayStepBack: () => void;
  onReplayStepForward: () => void;
  onReplaySpeedChange: (speed: number) => void;
  onRetryWorker: () => void;
};

export function SolverControls({
  status,
  replayState,
  workerHealth,
  hasSolution,
  replayIndex,
  replayTotalSteps,
  replaySpeed,
  onRun,
  onCancel,
  onApply,
  onAnimate,
  onReplayPlayPause,
  onReplayStepBack,
  onReplayStepForward,
  onReplaySpeedChange,
  onRetryWorker,
}: SolverControlsProps) {
  const isRunning = status === 'running' || status === 'cancelling';
  const isReplayPlaying = replayState === 'playing';
  const replayDisabled = replayTotalSteps === 0;
  const replaySpeedValue = String(replaySpeed);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Solver run controls" className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onRun} disabled={workerHealth === 'crashed' || isRunning}>
          Run Solve
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel} disabled={!isRunning}>
          Cancel
        </Button>
        {workerHealth === 'crashed' ? (
          <Button size="sm" variant="secondary" onClick={onRetryWorker}>
            Retry Worker
          </Button>
        ) : null}
      </div>

      <div role="group" aria-label="Solution actions" className="flex flex-wrap gap-2">
        <Button size="sm" variant="tonal" onClick={onApply} disabled={!hasSolution}>
          Apply Solution
        </Button>
        <Button size="sm" variant="tonal" onClick={onAnimate} disabled={!hasSolution}>
          Animate Solution
        </Button>
      </div>

      <div role="group" aria-label="Replay controls" className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={onReplayPlayPause} disabled={replayDisabled}>
            {isReplayPlaying ? 'Pause' : 'Play'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReplayStepBack}
            disabled={replayDisabled || replayIndex === 0}
            aria-disabled={replayDisabled || replayIndex === 0}
          >
            Step Back
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onReplayStepForward}
            disabled={replayDisabled || replayIndex >= replayTotalSteps}
            aria-disabled={replayDisabled || replayIndex >= replayTotalSteps}
          >
            Step Forward
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="min-w-[4.5rem] text-xs tabular-nums text-muted"
            aria-live="polite"
            aria-label={`Replay step ${replayIndex} of ${replayTotalSteps}`}
          >
            Step {replayIndex} / {replayTotalSteps}
          </span>
          <label className="sr-only" htmlFor="replay-speed-select">
            Replay speed
          </label>
          <select
            id="replay-speed-select"
            className={inlineSelectClass}
            value={replaySpeedValue}
            onChange={(event) => {
              const nextSpeed = Number(event.target.value);
              if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
                return;
              }
              onReplaySpeedChange(nextSpeed);
            }}
          >
            {REPLAY_SPEED_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
