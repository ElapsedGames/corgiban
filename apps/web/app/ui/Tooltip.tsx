import { cloneElement, useId } from 'react';
import type { ReactElement } from 'react';

export type TooltipAlign = 'start' | 'center' | 'end';
export type TooltipResponsiveAlign =
  | TooltipAlign
  | {
      base?: TooltipAlign;
      sm?: TooltipAlign;
      xl?: TooltipAlign;
    };

export type TooltipProps = {
  content: string;
  children: ReactElement;
  align?: TooltipResponsiveAlign;
};

const alignmentClasses: Record<TooltipAlign, { base: string; sm: string; xl: string }> = {
  start: {
    base: 'left-0 right-auto translate-x-0',
    sm: 'sm:left-0 sm:right-auto sm:translate-x-0',
    xl: 'xl:left-0 xl:right-auto xl:translate-x-0',
  },
  center: {
    base: 'left-1/2 right-auto -translate-x-1/2',
    sm: 'sm:left-1/2 sm:right-auto sm:-translate-x-1/2',
    xl: 'xl:left-1/2 xl:right-auto xl:-translate-x-1/2',
  },
  end: {
    base: 'right-0 left-auto translate-x-0',
    sm: 'sm:right-0 sm:left-auto sm:translate-x-0',
    xl: 'xl:right-0 xl:left-auto xl:translate-x-0',
  },
};

function resolveAlignmentClasses(align: TooltipResponsiveAlign): string {
  if (typeof align === 'string') {
    return alignmentClasses[align].base;
  }

  const baseAlign = align.base ?? 'center';
  const smAlign = align.sm;
  const xlAlign = align.xl;

  return [
    alignmentClasses[baseAlign].base,
    smAlign ? alignmentClasses[smAlign].sm : '',
    xlAlign ? alignmentClasses[xlAlign].xl : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Tooltip({ content, children, align = 'center' }: TooltipProps) {
  const tooltipId = useId();

  const existingDescribedBy = children.props['aria-describedby'] as string | undefined;
  const mergedDescribedBy = existingDescribedBy ? `${existingDescribedBy} ${tooltipId}` : tooltipId;

  return (
    <span className="relative inline-flex group">
      {cloneElement(children, { 'aria-describedby': mergedDescribedBy })}
      <span
        id={tooltipId}
        role="tooltip"
        className={[
          'pointer-events-none absolute top-full z-50 mt-2 w-[18rem] max-w-[calc(100vw-2rem)] rounded-app-md border border-border bg-panel px-3 py-2 text-xs font-normal normal-case tracking-normal text-fg opacity-0 shadow-lg motion-safe:transition group-hover:opacity-100 group-focus-within:opacity-100 whitespace-normal break-words sm:w-[20rem] xl:w-[24rem]',
          resolveAlignmentClasses(align),
        ].join(' ')}
      >
        {content}
      </span>
    </span>
  );
}
