import { useId } from 'react';

import type { AlgorithmId } from '@corgiban/solver';

import { getBenchmarkSuiteLevelRefs, type BenchmarkSuiteConfig } from '../ports/benchmarkPort';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export type SuiteLevelOption = {
  id: string;
  name: string;
};

export type SuiteAlgorithmOption = {
  id: AlgorithmId;
  label: string;
  disabled?: boolean;
};

export type BenchmarkSuiteBuilderProps = {
  suite: BenchmarkSuiteConfig;
  status: 'idle' | 'running' | 'cancelling' | 'completed' | 'cancelled' | 'failed';
  availableLevels: SuiteLevelOption[];
  availableAlgorithms: SuiteAlgorithmOption[];
  onToggleLevel: (levelRef: string) => void;
  onToggleAlgorithm: (algorithmId: AlgorithmId) => void;
  onSetRepetitions: (value: number) => void;
  onSetWarmupRepetitions?: (value: number) => void;
  onSetTimeBudgetMs: (value: number) => void;
  onSetNodeBudget: (value: number) => void;
  onRun: () => void;
  onCancel: () => void;
};

export function BenchmarkSuiteBuilder({
  suite,
  status,
  availableLevels,
  availableAlgorithms,
  onToggleLevel,
  onToggleAlgorithm,
  onSetRepetitions,
  onSetWarmupRepetitions,
  onSetTimeBudgetMs,
  onSetNodeBudget,
  onRun,
  onCancel,
}: BenchmarkSuiteBuilderProps) {
  const isRunning = status === 'running' || status === 'cancelling';
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            Suite Builder
          </h2>
          <p className="text-sm text-muted">
            Pick the level set, solver variants, warm-ups, and run budgets before you measure.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRun} disabled={isRunning}>
            Run Suite
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={!isRunning}>
            Cancel
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="rounded-app-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Levels
          </legend>
          <div className="max-h-48 space-y-2 overflow-auto pr-1 text-sm" tabIndex={0}>
            {availableLevels.map((level) => (
              <label key={level.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={getBenchmarkSuiteLevelRefs(suite).includes(level.id)}
                  onChange={() => onToggleLevel(level.id)}
                />
                <span>{level.name}</span>
                <span className="text-xs text-muted">({level.id})</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-app-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Algorithms
          </legend>
          <div className="space-y-2 text-sm">
            {availableAlgorithms.map((algorithm) => (
              <label
                key={algorithm.id}
                className={`flex items-center gap-2 ${algorithm.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={suite.algorithmIds.includes(algorithm.id)}
                  onChange={() => onToggleAlgorithm(algorithm.id)}
                  disabled={algorithm.disabled}
                />
                <span>{algorithm.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Input
          label="Repetitions"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          step={1}
          value={suite.repetitions}
          onChange={(event) => onSetRepetitions(Number(event.target.value))}
          hint="Measured runs stored in history for each level and algorithm combination."
        />
        <Input
          label="Warm-up Repetitions"
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          step={1}
          value={suite.warmupRepetitions}
          onChange={(event) => onSetWarmupRepetitions?.(Number(event.target.value))}
          hint="Warm-up runs are executed before measured runs and are not stored."
        />
        <Input
          label="Time Budget (ms)"
          type="number"
          inputMode="numeric"
          min={1}
          max={300000}
          step={1}
          value={suite.timeBudgetMs}
          onChange={(event) => onSetTimeBudgetMs(Number(event.target.value))}
          hint="Per-run wall-clock budget before a solve is marked as timed out."
        />
        <Input
          label="Node Budget"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000000}
          step={1}
          value={suite.nodeBudget}
          onChange={(event) => onSetNodeBudget(Number(event.target.value))}
          hint="Per-run expansion cap when you want deterministic upper bounds."
        />
      </div>
    </section>
  );
}
