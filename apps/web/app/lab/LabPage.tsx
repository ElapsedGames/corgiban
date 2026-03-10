import { LabEditorPanel } from './LabEditorPanel';
import { LabPreviewPanel } from './LabPreviewPanel';
import { LabWorkerStatusPanel } from './LabWorkerStatusPanel';
import { useLabOrchestration } from './useLabOrchestration';

export function LabPage() {
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
    importLabPayload,
    exportLabPayload,
  } = useLabOrchestration();

  return (
    <main id="main-content" className="page-shell play-shell">
      <header aria-label="Level Lab" className="page-header">
        <h1 className="page-title">Level Lab</h1>
        <p className="page-subtitle">
          Edit row encodings, preview gameplay, run worker-backed solve and bench checks, and
          import/export level JSON.
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
