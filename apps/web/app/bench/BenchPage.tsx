import type { AlgorithmId } from '@corgiban/solver';

import type { BenchmarkRunRecord, BenchmarkSuiteConfig } from '../ports/benchmarkPort';
import type { BenchDiagnosticsState, BenchPerfEntry, BenchRunStatus } from '../state/benchSlice';
import { BenchDiagnosticsPanel } from './BenchDiagnosticsPanel';
import { BenchmarkExportImportControls } from './BenchmarkExportImportControls';
import { BenchmarkPerfPanel } from './BenchmarkPerfPanel';
import {
  BenchmarkSuiteBuilder,
  type SuiteAlgorithmOption,
  type SuiteLevelOption,
} from './BenchmarkSuiteBuilder';
import { BenchmarkResultsTable } from './BenchmarkResultsTable';

export type BenchPageProps = {
  suite: BenchmarkSuiteConfig;
  status: BenchRunStatus;
  progress: {
    totalRuns: number;
    completedRuns: number;
    latestResultId: string | null;
  };
  results: BenchmarkRunRecord[];
  diagnostics: BenchDiagnosticsState;
  perfEntries: BenchPerfEntry[];
  debug: boolean;
  availableLevels: SuiteLevelOption[];
  availableAlgorithms: SuiteAlgorithmOption[];
  onToggleLevel: (levelId: string) => void;
  onToggleAlgorithm: (algorithmId: AlgorithmId) => void;
  onSetRepetitions: (value: number) => void;
  onSetTimeBudgetMs: (value: number) => void;
  onSetNodeBudget: (value: number) => void;
  onRun: () => void;
  onCancel: () => void;
  onClearPerfEntries: () => void;
  onExportReport: () => void;
  onImportReport: () => void;
  onExportLevelPack: () => void;
  onImportLevelPack: () => void;
  onClearResults: () => void;
};

export function BenchPage({
  suite,
  status,
  progress,
  results,
  diagnostics,
  perfEntries,
  debug,
  availableLevels,
  availableAlgorithms,
  onToggleLevel,
  onToggleAlgorithm,
  onSetRepetitions,
  onSetTimeBudgetMs,
  onSetNodeBudget,
  onRun,
  onCancel,
  onClearPerfEntries,
  onExportReport,
  onImportReport,
  onExportLevelPack,
  onImportLevelPack,
  onClearResults,
}: BenchPageProps) {
  return (
    <main className="page-shell">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">Bench</p>
        <h1 className="page-title">Benchmark Suite</h1>
        <p className="page-subtitle">
          Run solver benchmarks across multiple levels with persisted results and diagnostics.
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <BenchmarkSuiteBuilder
            suite={suite}
            status={status}
            availableLevels={availableLevels}
            availableAlgorithms={availableAlgorithms}
            onToggleLevel={onToggleLevel}
            onToggleAlgorithm={onToggleAlgorithm}
            onSetRepetitions={onSetRepetitions}
            onSetTimeBudgetMs={onSetTimeBudgetMs}
            onSetNodeBudget={onSetNodeBudget}
            onRun={onRun}
            onCancel={onCancel}
          />

          <BenchmarkResultsTable results={results} />

          <BenchmarkExportImportControls
            disableExportReport={results.length === 0}
            disableExportLevelPack={suite.levelIds.length === 0}
            disableImports={status === 'running' || status === 'cancelling'}
            disableClear={results.length === 0}
            onExportReport={onExportReport}
            onImportReport={onImportReport}
            onExportLevelPack={onExportLevelPack}
            onImportLevelPack={onImportLevelPack}
            onClearResults={onClearResults}
          />
        </div>

        <div className="space-y-6">
          <BenchDiagnosticsPanel status={status} progress={progress} diagnostics={diagnostics} />

          {debug ? <BenchmarkPerfPanel entries={perfEntries} onClear={onClearPerfEntries} /> : null}
        </div>
      </div>
    </main>
  );
}
