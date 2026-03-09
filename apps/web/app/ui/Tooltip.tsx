import { cloneElement, useId } from 'react';
import type { ReactElement } from 'react';

export type TooltipProps = {
  content: string;
  children: ReactElement;
};

export function Tooltip({ content, children }: TooltipProps) {
  const tooltipId = useId();

  const existingDescribedBy = children.props['aria-describedby'] as string | undefined;
  const mergedDescribedBy = existingDescribedBy ? `${existingDescribedBy} ${tooltipId}` : tooltipId;

  return (
    <span className="relative inline-flex group">
      {cloneElement(children, { 'aria-describedby': mergedDescribedBy })}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-max -translate-x-1/2 rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] px-2 py-1 text-xs text-[color:var(--color-fg)] opacity-0 shadow-lg motion-safe:transition group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
