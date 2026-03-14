import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

import { Tooltip, type TooltipAlign } from './Tooltip';

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  annotation?: string;
  annotationAlign?: TooltipAlign;
  hint?: string;
  error?: string;
};

export function Input({
  label,
  annotation,
  annotationAlign = 'center',
  hint,
  error,
  id,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const annotationId = annotation ? `${inputId}-annotation` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [annotationId, errorId ?? hintId].filter(Boolean).join(' ') || undefined;

  const inputClasses = [
    'w-full rounded-app-md border border-border bg-panel px-3 py-2 text-sm text-fg placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    error ? 'border-error focus-visible:ring-error' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1">
      {label ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold uppercase tracking-wide text-muted">
          <label htmlFor={inputId}>
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
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={inputClasses}
        {...props}
      />
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
