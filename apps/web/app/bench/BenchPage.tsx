import type { AlgorithmId } from '@corgiban/solver';

import type { BenchmarkRunRecord, BenchmarkSuiteConfig } from '../ports/benchmarkPort';
import type { BenchDiagnosticsState, BenchPerfEntry, BenchRunStatus } from '../state/benchSlice';
import { BenchDiagnosticsPanel } from './BenchDiagnosticsPanel';
import { BenchmarkAnalyticsPanel } from './BenchmarkAnalyticsPanel';
import type { BenchmarkComparisonSnapshot } from './benchmarkAnalytics';
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
  onSetWarmupRepetitions?: (value: number) => void;
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
  onExportComparisonSnapshot?: (snapshot: BenchmarkComparisonSnapshot) => void;
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
  onSetWarmupRepetitions,
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
  onExportComparisonSnapshot,
}: BenchPageProps) {
  const isSuiteActive = status === 'running' || status === 'cancelling';

  return (
    <main id="main-content" className="page-shell">
      <header aria-label="Benchmark Suite page header">
        <p
          aria-hidden="true"
          className="mb-1 text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]"
        >
          Bench
        </p>
        <h1 className="page-title">Benchmark Suite</h1>
        <p className="page-subtitle">
          Run solver benchmarks across multiple levels and review execution outcomes separately from
          persistence durability.
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
            onSetWarmupRepetitions={onSetWarmupRepetitions}
            onSetTimeBudgetMs={onSetTimeBudgetMs}
            onSetNodeBudget={onSetNodeBudget}
            onRun={onRun}
            onCancel={onCancel}
          />

          <BenchmarkResultsTable results={results} />

          <BenchmarkAnalyticsPanel
            results={results}
            onExportSnapshot={onExportComparisonSnapshot ?? (() => undefined)}
          />

          <BenchmarkExportImportControls
            disableExportReport={results.length === 0}
            disableExportLevelPack={suite.levelIds.length === 0}
            disableImports={isSuiteActive}
            disableClear={isSuiteActive || results.length === 0}
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
