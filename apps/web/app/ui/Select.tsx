import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';

import { Tooltip, type TooltipAlign } from './Tooltip';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  annotation?: string;
  annotationAlign?: TooltipAlign;
  hint?: string;
  error?: string;
};

export function Select({
  label,
  annotation,
  annotationAlign = 'center',
  hint,
  error,
  id,
  className,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const annotationId = annotation ? `${selectId}-annotation` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [annotationId, errorId ?? hintId].filter(Boolean).join(' ') || undefined;

  const selectClasses = [
    'w-full rounded-app-md border border-border bg-panel px-3 py-2 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    error ? 'border-error focus-visible:ring-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1">
      {label ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <label htmlFor={selectId}>
            <span>{label}</span>
          </label>
          <span className="inline-flex items-center gap-1.5">
            {annotation ? (
              <Tooltip content={annotation} align={annotationAlign}>
                <button
                  type="button"
                  aria-label={`${label} help`}
                  onClick={(event) => event.preventDefault()}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
                >
                  i
                </button>
              </Tooltip>
            ) : null}
          </span>
          {annotation ? (
            <span id={annotationId} className="sr-only">
              {annotation}
            </span>
          ) : null}
        </div>
      ) : null}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={selectClasses}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} className="text-xs text-error-text">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
