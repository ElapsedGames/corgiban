import type { PlayableEntry } from '../levels/temporaryLevelCatalog';
import { LabEditorPanel } from './LabEditorPanel';
import { LabPreviewPanel } from './LabPreviewPanel';
import { LabWorkerStatusPanel } from './LabWorkerStatusPanel';
import { useLabOrchestration } from './useLabOrchestration';

export type LabPageProps = {
  initialPlayable?: PlayableEntry;
};

export function LabPage({ initialPlayable }: LabPageProps) {
  const {
    format,
    input,
    parseState,
    previewState,
    solveState,
    benchState,
    setFormat,
    setInput,
    applyParse,
    movePreview,
    resetPreview,
    runSolve,
    cancelSolve,
    applySolution,
    runBench,
    openInPlay,
    sendToBench,
    importLabPayload,
    exportLabPayload,
  } = useLabOrchestration(initialPlayable);

  return (
    <main id="main-content" className="page-shell play-shell">
      <header aria-label="Level Lab" className="page-header">
        <h1 className="page-title">Level Lab</h1>
        <p className="page-subtitle">
          Edit or paste a level, validate it, preview it locally, then send it to Play, Bench, or a
          quick worker check.
        </p>
      </header>

      <div className="mt-3 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <LabEditorPanel
          format={format}
          input={input}
          parseState={parseState}
          onFormatChange={setFormat}
          onInputChange={setInput}
          onParse={applyParse}
          onImport={importLabPayload}
          onExport={exportLabPayload}
        />

        <div className="space-y-6">
          <LabPreviewPanel
            previewState={previewState}
            onMove={movePreview}
            onReset={resetPreview}
            onOpenInPlay={openInPlay}
            onSendToBench={sendToBench}
          />
          <LabWorkerStatusPanel
            solveState={solveState}
            benchState={benchState}
            onRunSolve={runSolve}
            onCancelSolve={cancelSolve}
            onApplySolution={applySolution}
            onRunBench={runBench}
          />
        </div>
      </div>
    </main>
  );
}
