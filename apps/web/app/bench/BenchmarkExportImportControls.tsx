import { useId } from 'react';

import { Button } from '../ui/Button';

export type BenchmarkExportImportControlsProps = {
  disableExportReport?: boolean;
  disableExportLevelPack?: boolean;
  disableImports?: boolean;
  disableClear?: boolean;
  onExportReport: () => void;
  onImportReport: () => void;
  onExportLevelPack: () => void;
  onImportLevelPack: () => void;
  onClearResults: () => void;
};

export function BenchmarkExportImportControls({
  disableExportReport,
  disableExportLevelPack,
  disableImports,
  disableClear,
  onExportReport,
  onImportReport,
  onExportLevelPack,
  onImportLevelPack,
  onClearResults,
}: BenchmarkExportImportControlsProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        Import / Export
      </h2>
      <p className="mt-1 text-sm text-[color:var(--color-muted)]">
        Share benchmark history reports and level packs. File System Access API is used when
        available.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Button variant="secondary" onClick={onExportReport} disabled={disableExportReport}>
          Export History
        </Button>
        <Button variant="secondary" onClick={onImportReport} disabled={disableImports}>
          Import History
        </Button>
        <Button variant="ghost" onClick={onClearResults} disabled={disableClear}>
          Clear Results
        </Button>
        <Button variant="secondary" onClick={onExportLevelPack} disabled={disableExportLevelPack}>
          Export Level Pack
        </Button>
        <Button variant="secondary" onClick={onImportLevelPack} disabled={disableImports}>
          Import Level Pack
        </Button>
      </div>
    </section>
  );
}
