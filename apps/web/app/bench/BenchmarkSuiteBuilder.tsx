import { useId } from 'react';

import type { AlgorithmId } from '@corgiban/solver';

import { getBenchmarkSuiteLevelRefs, type BenchmarkSuiteConfig } from '../ports/benchmarkPort';
import { formatSolverAlgorithmDescription } from '../solver/algorithmLabels';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Tooltip } from '../ui/Tooltip';

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
  const selectedLevelRefs = getBenchmarkSuiteLevelRefs(suite);
  const algorithmCount = availableAlgorithms.length;

  const resolveTooltipAlign = (index: number, count: number): 'start' | 'center' | 'end' => {
    // The bench grid is 3 columns on smaller desktop and 6 columns on xl.
    // This alignment pattern avoids right-edge overflow in the 3-column layout
    // while still keeping the xl row balanced enough.
    if (index % 3 === 0) {
      return 'start';
    }
    if (index % 3 === 2 || index === count - 1) {
      return 'end';
    }
    return 'center';
  };

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
            Choose the algorithms, levels, warm-up runs, and run limits before you start the
            benchmark.
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

      <div className="grid gap-4">
        <fieldset className="rounded-app-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Algorithms
          </legend>
          <div className="grid items-stretch gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {availableAlgorithms.map((algorithm, index) => {
              const isSelected = suite.algorithmIds.includes(algorithm.id);
              const isDisabled = algorithm.disabled ?? false;
              const description = formatSolverAlgorithmDescription(algorithm.id);

              return (
                <div key={algorithm.id} className="relative h-full">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                    onClick={() => onToggleAlgorithm(algorithm.id)}
                    className={[
                      'flex h-full min-h-[3.25rem] w-full items-center justify-center rounded-app-md border px-3 py-2 pr-7 text-center motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                      isSelected
                        ? 'border-accent bg-accent-surface text-fg shadow-sm'
                        : 'border-border bg-bg text-fg hover:border-accent hover:bg-panel',
                      isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                    ].join(' ')}
                  >
                    <span className="block text-sm font-semibold leading-tight">
                      {algorithm.label}
                    </span>
                  </button>
                  <div className="absolute right-2 top-2">
                    <Tooltip
                      content={description}
                      align={{ base: 'end', sm: resolveTooltipAlign(index, algorithmCount) }}
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`${algorithm.label} help`}
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
                      >
                        i
                      </span>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="rounded-app-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            Levels
          </legend>
          <div
            className="grid max-h-80 gap-2 overflow-auto pr-1 text-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            tabIndex={0}
          >
            {availableLevels.map((level) => {
              const isSelected = selectedLevelRefs.includes(level.id);

              return (
                <button
                  key={level.id}
                  type="button"
                  role="switch"
                  aria-checked={isSelected}
                  onClick={() => onToggleLevel(level.id)}
                  className={[
                    'flex min-h-[3.5rem] w-full items-center rounded-app-md border px-3 py-2 text-left motion-safe:transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                    isSelected
                      ? 'border-accent bg-accent-surface shadow-sm'
                      : 'border-border bg-bg hover:border-accent hover:bg-panel',
                  ].join(' ')}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{level.name}</span>
                    <span className="block text-xs text-muted">{level.id}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-3">
        <div className="w-full sm:basis-[20%]">
          <Input
            label="Repetitions"
            annotation="These are the runs that get saved in your benchmark history for each level and algorithm."
            annotationAlign="start"
            type="number"
            inputMode="numeric"
            min={1}
            max={1000}
            step={1}
            value={suite.repetitions}
            onChange={(event) => onSetRepetitions(Number(event.target.value))}
          />
        </div>
        <div className="w-full sm:basis-[20%]">
          <Input
            label="Warm-up Runs"
            annotation="These practice runs happen before the saved runs. They help settle performance and are not saved."
            annotationAlign="start"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            step={1}
            value={suite.warmupRepetitions}
            onChange={(event) => onSetWarmupRepetitions?.(Number(event.target.value))}
          />
        </div>
        <div className="w-full sm:basis-[27%]">
          <Input
            label="Time Budget (MS)"
            annotation="This is the time limit for each run. If a solve takes longer, it times out."
            annotationAlign="start"
            type="number"
            inputMode="numeric"
            min={1}
            max={300000}
            step={1}
            value={suite.timeBudgetMs}
            onChange={(event) => onSetTimeBudgetMs(Number(event.target.value))}
          />
        </div>
        <div className="w-full sm:basis-[27%]">
          <Input
            label="Node Budget"
            annotation="This is the search limit for each run. Use it when you want a hard cap on how much work the solver can do."
            annotationAlign="start"
            type="number"
            inputMode="numeric"
            min={1}
            max={100000000}
            step={1}
            value={suite.nodeBudget}
            onChange={(event) => onSetNodeBudget(Number(event.target.value))}
          />
        </div>
      </div>
    </section>
  );
}
