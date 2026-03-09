import { useId } from 'react';

import type { AlgorithmId } from '@corgiban/solver';

import type { BenchmarkSuiteConfig } from '../ports/benchmarkPort';
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
  onToggleLevel: (levelId: string) => void;
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
      className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-lg font-semibold">
            Suite Builder
          </h2>
          <p className="text-sm text-[color:var(--color-muted)]">
            Select levels, algorithms, and budgets for this benchmark suite.
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
        <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
            Levels
          </legend>
          <div className="max-h-48 space-y-2 overflow-auto pr-1 text-sm" tabIndex={0}>
            {availableLevels.map((level) => (
              <label key={level.id} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={suite.levelIds.includes(level.id)}
                  onChange={() => onToggleLevel(level.id)}
                />
                <span>{level.name}</span>
                <span className="text-xs text-[color:var(--color-muted)]">({level.id})</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
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
        />
      </div>
    </section>
  );
}
