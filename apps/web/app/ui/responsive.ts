const TAILWIND_BREAKPOINT_PX = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type TailwindBreakpoint = keyof typeof TAILWIND_BREAKPOINT_PX;

export function getMinWidthMediaQuery(breakpoint: TailwindBreakpoint): string {
  return `(min-width: ${TAILWIND_BREAKPOINT_PX[breakpoint]}px)`;
}

export function getMaxWidthMediaQuery(breakpoint: TailwindBreakpoint): string {
  return `(max-width: ${TAILWIND_BREAKPOINT_PX[breakpoint] - 1}px)`;
}
