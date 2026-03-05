import { useDispatch, useSelector } from 'react-redux';
import type { AlgorithmId } from '@corgiban/solver';
import { ALGORITHM_IDS, DEFAULT_ALGORITHM_ID, isImplementedAlgorithmId } from '@corgiban/solver';

import type { WorkerHealth } from '../ports/solverPort';
import type { AppDispatch, RootState } from '../state';
import { setSolverNodeBudget, setSolverTimeBudgetMs } from '../state/settingsSlice';
import { Input } from '../ui/Input';
import type {
  ReplayState,
  SolverProgressState,
  SolverRecommendation,
  SolverResultState,
  SolverRunStatus,
} from '../state/solverSlice';
import { Select } from '../ui/Select';
import { SolverControls } from './SolverControls';
import { SolverProgress } from './SolverProgress';

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
  onSelectAlgorithm: (algorithmId: AlgorithmId) => void;
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

const FALLBACK_ALGORITHM_ID =
  ALGORITHM_IDS.find((algorithmId) => isImplementedAlgorithmId(algorithmId)) ??
  DEFAULT_ALGORITHM_ID;

function formatAlgorithmLabel(algorithmId: AlgorithmId): string {
  if (isImplementedAlgorithmId(algorithmId)) {
    return algorithmId;
  }
  return `${algorithmId} (coming soon)`;
}

function recommendationLabel(recommendation: SolverRecommendation | null): string {
  if (!recommendation) {
    return 'No recommendation available yet.';
  }

  const { algorithmId, features } = recommendation;
  return `Recommended: ${algorithmId} (${features.boxCount} boxes, ${features.width}x${features.height})`;
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
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <Input
        label="Default Time Budget (ms)"
        type="number"
        min={1}
        step={1}
        value={solverTimeBudgetMs}
        onChange={(event) => {
          dispatch(setSolverTimeBudgetMs(toPositiveInt(event.target.value, solverTimeBudgetMs)));
        }}
      />
      <Input
        label="Default Node Budget"
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
  onSelectAlgorithm,
  onRun,
  onCancel,
  onApply,
  onAnimate,
  onReplayPlayPause,
  onReplayStepBack,
  onReplayStepForward,
  onReplaySpeedChange,
  onRetryWorker,
}: SolverPanelProps) {
  const preferredAlgorithmId =
    selectedAlgorithmId ?? recommendation?.algorithmId ?? FALLBACK_ALGORITHM_ID;
  const resolvedAlgorithmId = isImplementedAlgorithmId(preferredAlgorithmId)
    ? preferredAlgorithmId
    : FALLBACK_ALGORITHM_ID;

  return (
    <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Solver</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          {recommendationLabel(recommendation)}
        </p>
      </div>

      <div className="mb-4">
        <Select
          label="Algorithm"
          value={resolvedAlgorithmId}
          onChange={(event) => onSelectAlgorithm(event.target.value as AlgorithmId)}
          hint="Unavailable algorithms stay visible but are disabled until implemented."
        >
          {ALGORITHM_IDS.map((algorithmId) => (
            <option
              key={algorithmId}
              value={algorithmId}
              disabled={!isImplementedAlgorithmId(algorithmId)}
            >
              {formatAlgorithmLabel(algorithmId)}
            </option>
          ))}
        </Select>
      </div>

      <SolverBudgetSettings />

      <SolverControls
        status={status}
        replayState={replayState}
        workerHealth={workerHealth}
        hasSolution={Boolean(lastResult?.solutionMoves)}
        replayIndex={replayIndex}
        replayTotalSteps={replayTotalSteps}
        replaySpeed={replaySpeed}
        onRun={onRun}
        onCancel={onCancel}
        onApply={onApply}
        onAnimate={onAnimate}
        onReplayPlayPause={onReplayPlayPause}
        onReplayStepBack={onReplayStepBack}
        onReplayStepForward={onReplayStepForward}
        onReplaySpeedChange={onReplaySpeedChange}
        onRetryWorker={onRetryWorker}
      />

      <div className="mt-4">
        <SolverProgress status={status} progress={progress} lastResult={lastResult} error={error} />
      </div>
    </section>
  );
}
