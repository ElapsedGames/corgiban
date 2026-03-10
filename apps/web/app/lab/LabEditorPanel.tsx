import { useId } from 'react';

import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { LAB_INPUT_FORMAT_LABELS, type LabInputFormat } from './labFormat';
import type { ParseState } from './labTypes';

type LabEditorPanelProps = {
  format: LabInputFormat;
  input: string;
  parseState: ParseState;
  onFormatChange: (format: LabInputFormat) => void;
  onInputChange: (input: string) => void;
  onParse: () => void;
  onImport: () => void;
  onExport: () => void;
};

export function LabEditorPanel({
  format,
  input,
  parseState,
  onFormatChange,
  onInputChange,
  onParse,
  onImport,
  onExport,
}: LabEditorPanelProps) {
  const textareaId = useId();
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <h2 id={headingId} className="sr-only">
        Level Editor
      </h2>
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <Select
          label="Input format"
          value={format}
          onChange={(event) => onFormatChange(event.target.value as LabInputFormat)}
        >
          <option value="corg">{LAB_INPUT_FORMAT_LABELS.corg}</option>
          <option value="xsb">{LAB_INPUT_FORMAT_LABELS.xsb}</option>
          <option value="sok-0.17">{LAB_INPUT_FORMAT_LABELS['sok-0.17']}</option>
          <option value="slc-xml">{LAB_INPUT_FORMAT_LABELS['slc-xml']}</option>
        </Select>

        <div className="flex flex-wrap items-end gap-2">
          <Button onClick={onParse}>Parse Level</Button>
          <Button variant="secondary" onClick={onImport}>
            Import JSON
          </Button>
          <Button variant="secondary" onClick={onExport}>
            Export JSON
          </Button>
        </div>
      </div>

      <label
        htmlFor={textareaId}
        className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted"
      >
        Encoded level input
      </label>
      <textarea
        id={textareaId}
        className="mt-1 min-h-[280px] w-full resize-y rounded-app-md border border-border bg-bg px-3 py-2 text-sm font-mono text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
      />

      <p className="mt-2 break-all text-xs text-muted">
        Active level: {parseState.levelName} ({parseState.levelId})
      </p>
      <p
        aria-live={parseState.isError ? 'assertive' : 'polite'}
        role={parseState.isError ? 'alert' : undefined}
        className={`mt-1 break-all text-xs ${parseState.isError ? 'font-medium text-error-text' : 'text-muted'}`}
      >
        {parseState.message}
      </p>
    </section>
  );
}
