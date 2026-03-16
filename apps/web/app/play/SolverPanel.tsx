import { useEffect, useId, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AlgorithmId } from '@corgiban/solver';
import { ALGORITHM_IDS } from '@corgiban/solver';

import type { WorkerHealth } from '../ports/solverPort';
import type { AppDispatch, RootState } from '../state';
import { setSolverNodeBudget, setSolverTimeBudgetMs } from '../state/settingsSlice';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type {
  ReplayState,
  SolverProgressState,
  SolverRecommendation,
  SolverResultState,
  SolverRunStatus,
} from '../state/solverSlice';
import { Select } from '../ui/Select';
import { REPLAY_SPEED_OPTIONS, SolverControls, inlineSelectClass } from './SolverControls';
import { SolverProgress } from './SolverProgress';
import { formatSolverAlgorithmLabel } from '../solver/algorithmLabels';

export type SolverPanelProps = {
  recommendation: SolverRecommendation | null;
  selectedAlgorithmId: AlgorithmId | null;
  status: SolverRunStatus;
  progress: SolverProgressState | null;
  lastResult: SolverResultState | null;
  error: string | null;
  workerHealth: WorkerHealth;
  replayState: ReplayState;
  replayIndex: number;
  replayTotalSteps: number;
  replaySpeed: number;
  mobileRunLocked: boolean;
  onSelectAlgorithm: (algorithmId: AlgorithmId) => void;
  onRun: () => void;
  onCancel: () => void;
  onAnimate: () => void;
  onReplayPlayPause: () => void;
  onReplayStepBack: () => void;
  onReplayStepForward: () => void;
  onReplaySpeedChange: (speed: number) => void;
  onRetryWorker: () => void;
};

const FALLBACK_ALGORITHM_ID: AlgorithmId = 'greedyPush';
export const MOBILE_RUNNING_INDICATOR_DELAY_MS = 750;

function recommendationLabel(recommendation: SolverRecommendation | null): string {
  if (!recommendation) {
    return 'Pick an algorithm when you want to compare your playthrough with a worker solve.';
  }

  const { algorithmId, features } = recommendation;
  return `Start with ${formatSolverAlgorithmLabel(algorithmId)} for this ${features.boxCount}-box ${features.width}x${features.height} level.`;
}

function toPositiveInt(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.max(1, Math.floor(parsed));
}

function SolverBudgetSettings() {
  const dispatch = useDispatch<AppDispatch>();
  const solverTimeBudgetMs = useSelector((state: RootState) => state.settings.solverTimeBudgetMs);
  const solverNodeBudget = useSelector((state: RootState) => state.settings.solverNodeBudget);

  return (
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <Input
        label="Time Budget (MS)"
        annotation="This is the time limit for each solve run. If a solve takes longer, it times out."
        type="number"
        min={1}
        step={1}
        value={solverTimeBudgetMs}
        onChange={(event) => {
          dispatch(setSolverTimeBudgetMs(toPositiveInt(event.target.value, solverTimeBudgetMs)));
        }}
      />
      <Input
        label="Node Budget"
        annotation="This is the search limit for each solve run. Use it when you want a hard cap on solver work."
        type="number"
        min={1}
        step={1}
        value={solverNodeBudget}
        onChange={(event) => {
          dispatch(setSolverNodeBudget(toPositiveInt(event.target.value, solverNodeBudget)));
        }}
      />
    </div>
  );
}

export function SolverPanel({
  recommendation,
  selectedAlgorithmId,
  status,
  progress,
  lastResult,
  error,
  workerHealth,
  replayState,
  replayIndex,
  replayTotalSteps,
  replaySpeed,
  mobileRunLocked,
  onSelectAlgorithm,
  onRun,
  onCancel,
  onAnimate,
  onReplayPlayPause,
  onReplayStepBack,
  onReplayStepForward,
  onReplaySpeedChange,
  onRetryWorker,
}: SolverPanelProps) {
  const headingId = useId();
  const mobileHeadingId = `${headingId}-mobile`;
  const desktopHeadingId = `${headingId}-desktop`;
  const preferredAlgorithmId =
    selectedAlgorithmId ?? recommendation?.algorithmId ?? FALLBACK_ALGORITHM_ID;
  const resolvedAlgorithmId = preferredAlgorithmId;
  const isRunning = status === 'running' || status === 'cancelling';
  const hasSolution = Boolean(lastResult?.solutionMoves);
  const mobileReplaySelectClass = `${inlineSelectClass} min-h-[42px] w-full px-4 py-2 text-sm`;
  const mobileRunNotice = status === 'cancelling' ? 'Stopping solver...' : 'Solver running...';
  const mobileRunMetrics = progress
    ? `${Math.round(progress.elapsedMs)} ms`
    : activeRunLabel(status);
  const [showMobileRunningNotice, setShowMobileRunningNotice] = useState(false);

  function activeRunLabel(currentStatus: SolverRunStatus): string {
    return currentStatus === 'cancelling' ? 'Cancelling' : 'Working';
  }

  useEffect(() => {
    if (!isRunning) {
      setShowMobileRunningNotice(false);
      return;
    }

    setShowMobileRunningNotice(false);
    const timeoutId = window.setTimeout(() => {
      setShowMobileRunningNotice(true);
    }, MOBILE_RUNNING_INDICATOR_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isRunning]);

  return (
    <>
      <section
        aria-labelledby={mobileHeadingId}
        className="rounded-app-lg border border-border bg-panel p-4 shadow-lg lg:hidden"
      >
        <h2 id={mobileHeadingId} className="text-sm font-semibold">
          Play first or let the game play for you... usually.
        </h2>

        {isRunning && showMobileRunningNotice ? (
          <div
            aria-live="polite"
            className="mt-4 flex items-center gap-3 rounded-app-md border border-accent-border bg-accent-surface px-3 py-3 text-sm font-semibold text-accent"
          >
            <span
              className="size-2 shrink-0 rounded-full bg-accent animate-pulse"
              aria-hidden="true"
            />
            <span>{mobileRunNotice}</span>
            <span className="ml-auto text-xs font-medium text-muted">{mobileRunMetrics}</span>
          </div>
        ) : null}

        {mobileRunLocked ? (
          <div className="mt-4 rounded-app-md border border-error-border bg-error-surface px-3 py-3 text-sm text-error-text">
            <p className="font-semibold">Solver did not complete this level.</p>
            <p className="mt-1 text-xs font-medium">
              Select another level before trying Run Solve again.
            </p>
          </div>
        ) : null}

        {!mobileRunLocked || hasSolution || isRunning || workerHealth === 'crashed' ? (
          <div
            role="group"
            aria-label="Mobile solver controls"
            className="mt-4 grid grid-cols-2 gap-2"
          >
            {isRunning ? (
              <Button className="w-full" size="md" variant="secondary" onClick={onCancel}>
                Cancel
              </Button>
            ) : hasSolution ? (
              <Button className="w-full" size="md" variant="tonal" onClick={onAnimate}>
                Animate Solution
              </Button>
            ) : !mobileRunLocked ? (
              <Button
                className="w-full"
                size="md"
                onClick={onRun}
                disabled={workerHealth === 'crashed'}
              >
                Run Solve
              </Button>
            ) : (
              <div aria-hidden="true" />
            )}
            {hasSolution ? (
              <div className="w-full">
                <label className="sr-only" htmlFor="mobile-replay-speed-select">
                  Mobile replay speed
                </label>
                <select
                  id="mobile-replay-speed-select"
                  aria-label="Mobile replay speed"
                  className={mobileReplaySelectClass}
                  value={String(replaySpeed)}
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
            ) : (
              <div aria-hidden="true" />
            )}
            {workerHealth === 'crashed' ? (
              <Button
                className="col-span-2 w-full"
                size="md"
                variant="secondary"
                onClick={onRetryWorker}
              >
                Retry Worker
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby={desktopHeadingId}
        className="hidden rounded-app-lg border border-border bg-panel p-5 shadow-lg lg:block"
      >
        <div className="mb-4">
          <h2 id={desktopHeadingId} className="text-lg font-semibold">
            Solver
          </h2>
          <p className="text-sm text-muted">{recommendationLabel(recommendation)}</p>
        </div>

        <div className="mb-4">
          <Select
            label="Algorithm"
            annotation="Pick the worker search method. The recommendation above is the best starting point for most puzzles."
            value={resolvedAlgorithmId}
            onChange={(event) => onSelectAlgorithm(event.target.value as AlgorithmId)}
          >
            {ALGORITHM_IDS.map((algorithmId) => (
              <option key={algorithmId} value={algorithmId}>
                {formatSolverAlgorithmLabel(algorithmId)}
              </option>
            ))}
          </Select>
        </div>

        <details className="mt-5 rounded-app-md border border-border bg-bg/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-fg">
            Advanced budgets
          </summary>
          <p className="mt-2 text-sm text-muted">
            Leave these at their defaults unless you are comparing algorithms or trying to keep a
            long solve run capped.
          </p>
          <SolverBudgetSettings />
        </details>

        <hr className="my-5 border-border" />

        <SolverControls
          status={status}
          replayState={replayState}
          workerHealth={workerHealth}
          hasSolution={hasSolution}
          replayIndex={replayIndex}
          replayTotalSteps={replayTotalSteps}
          replaySpeed={replaySpeed}
          onRun={onRun}
          onCancel={onCancel}
          onAnimate={onAnimate}
          onReplayPlayPause={onReplayPlayPause}
          onReplayStepBack={onReplayStepBack}
          onReplayStepForward={onReplayStepForward}
          onReplaySpeedChange={onReplaySpeedChange}
          onRetryWorker={onRetryWorker}
        />

        <div className="mt-5">
          <SolverProgress
            status={status}
            progress={progress}
            lastResult={lastResult}
            error={error}
          />
        </div>
      </section>
    </>
  );
}
