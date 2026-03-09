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
    resetPreview,
    runSolve,
    cancelSolve,
    applySolution,
    runBench,
    importLabPayload,
    exportLabPayload,
  } = useLabOrchestration();

  return (
    <main id="main-content" className="page-shell">
      <header aria-label="Level Lab">
        <p
          aria-hidden="true"
          className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]"
        >
          Lab
        </p>
        <h1 className="page-title">Level Lab</h1>
        <p className="page-subtitle">
          Edit row encodings, preview gameplay, run worker-backed solve and bench checks, and
          import/export level JSON.
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
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
          <LabPreviewPanel previewState={previewState} onReset={resetPreview} />
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
