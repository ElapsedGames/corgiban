import { useId } from 'react';

import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Tooltip } from '../ui/Tooltip';
import {
  LAB_INPUT_FORMAT_CELL_CODES,
  LAB_INPUT_FORMAT_CELL_CODE_HINTS,
  LAB_INPUT_FORMAT_LABELS,
  type LabInputFormat,
} from './labFormat';
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
  const cellCodes = LAB_INPUT_FORMAT_CELL_CODES[format];
  const cellCodeHint = LAB_INPUT_FORMAT_CELL_CODE_HINTS[format];

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <h2 id={headingId} className="sr-only">
        Level Editor
      </h2>
      <p className="text-sm text-muted">
        Start with the level text. Parse Level refreshes the preview and worker tools with whatever
        is currently in the editor.
      </p>
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <Select
          label="Input format"
          annotation="Pick the format your current editor text uses before you parse or convert it."
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

      <div className="mt-4 rounded-app-md border border-border bg-bg px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Cell codes for {LAB_INPUT_FORMAT_LABELS[format]}
          </p>
          {cellCodeHint ? (
            <Tooltip content={cellCodeHint} align="start">
              <span
                role="button"
                tabIndex={0}
                aria-label={`Cell codes for ${LAB_INPUT_FORMAT_LABELS[format]} help`}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
              >
                i
              </span>
            </Tooltip>
          ) : null}
        </div>
        <dl className="mt-2 grid auto-rows-fr gap-2 sm:grid-cols-4">
          {cellCodes.map(({ label, value }) => (
            <div
              key={`${format}-${label}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-app-sm border border-border bg-panel px-2 py-1.5"
            >
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
              <dd className="min-w-[3.25rem] rounded border border-border bg-bg px-2 py-0.5 text-center font-mono text-xs font-semibold text-fg">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <label htmlFor={textareaId}>Level text</label>
        <Tooltip
          content="Parse Level uses the current editor text exactly as shown here."
          align="start"
        >
          <span
            role="button"
            tabIndex={0}
            aria-label="Level text help"
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
          >
            i
          </span>
        </Tooltip>
      </div>
      <textarea
        id={textareaId}
        className="mt-1 min-h-[280px] w-full resize-y rounded-app-md border border-border bg-bg px-3 py-2 text-sm font-mono text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
      />

      <div className="mt-3 rounded-app-md border border-border bg-bg px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Active level</p>
        <p className="mt-1 break-all text-sm text-fg">
          {parseState.levelName} <span className="text-xs text-muted">({parseState.levelId})</span>
        </p>
        <p
          aria-live={parseState.isError ? 'assertive' : 'polite'}
          role={parseState.isError ? 'alert' : undefined}
          className={`mt-2 break-all text-xs ${parseState.isError ? 'font-medium text-error-text' : 'text-muted'}`}
        >
          {parseState.message}
        </p>
      </div>
    </section>
  );
}
