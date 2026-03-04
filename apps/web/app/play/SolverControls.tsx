import type { WorkerHealth } from '../ports/solverPort';
import type { ReplayState, SolverRunStatus } from '../state/solverSlice';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

const REPLAY_SPEED_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1, label: '1x' },
  { value: 1.5, label: '1.5x' },
  { value: 2, label: '2x' },
] as const;

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
    <section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onRun} disabled={workerHealth === 'crashed' || isRunning}>
          Run solve
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={!isRunning}>
          Cancel
        </Button>
        {workerHealth === 'crashed' ? (
          <Button variant="ghost" onClick={onRetryWorker}>
            Retry worker
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onApply} disabled={!hasSolution}>
          Apply solution
        </Button>
        <Button variant="secondary" onClick={onAnimate} disabled={!hasSolution}>
          Animate solution
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onReplayPlayPause} disabled={replayDisabled}>
          {isReplayPlaying ? 'Pause replay' : 'Play replay'}
        </Button>
        <Button
          variant="ghost"
          onClick={onReplayStepBack}
          disabled={replayDisabled || replayIndex === 0}
        >
          Step back
        </Button>
        <Button
          variant="ghost"
          onClick={onReplayStepForward}
          disabled={replayDisabled || replayIndex >= replayTotalSteps}
        >
          Step forward
        </Button>
        <span className="text-xs text-[color:var(--color-muted)]">
          Replay {replayIndex}/{replayTotalSteps}
        </span>
        <div className="min-w-[8rem] flex-1 sm:max-w-[9rem]">
          <Select
            label="Replay speed"
            value={replaySpeedValue}
            onChange={(event) => {
              const nextSpeed = Number(event.target.value);
              if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
                return;
              }
              onReplaySpeedChange(nextSpeed);
            }}
            className="w-auto"
          >
            {REPLAY_SPEED_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </section>
  );
}
