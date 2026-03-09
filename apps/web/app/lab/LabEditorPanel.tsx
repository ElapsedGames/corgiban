import { useId } from 'react';

import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { type LabInputFormat } from './labFormat';
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
      className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg"
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
          <option value="corg">CORG</option>
          <option value="xsb">XSB</option>
          <option value="sok-0.17">SOK 0.17</option>
          <option value="slc-xml">SLC XML</option>
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
        className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]"
      >
        Encoded level input
      </label>
      <textarea
        id={textareaId}
        className="mt-1 min-h-[280px] w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-sm font-mono text-[color:var(--color-fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
      />

      <p className="mt-2 break-all text-xs text-[color:var(--color-muted)]">
        Active level: {parseState.levelName} ({parseState.levelId})
      </p>
      <p
        aria-live={parseState.isError ? 'assertive' : 'polite'}
        role={parseState.isError ? 'alert' : undefined}
        className={`mt-1 break-all text-xs ${parseState.isError ? 'font-medium text-red-600 dark:text-red-400' : 'text-[color:var(--color-muted)]'}`}
      >
        {parseState.message}
      </p>
    </section>
  );
}
