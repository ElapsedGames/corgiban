import type { SolveContext } from './algorithm';

export const CLOCK_UNAVAILABLE_ERROR_MESSAGE =
  'Solver clock source unavailable. Pass context.nowMs when performance.now is unavailable.';

function defaultNowMs(): (() => number) | null {
  const perf = globalThis.performance;
  if (perf && typeof perf.now === 'function') {
    return () => perf.now();
  }
  return null;
}

export function resolveNowMs(context: SolveContext): (() => number) | null {
  return context.nowMs ?? defaultNowMs();
}

export function safeElapsedMs(nowMs: () => number, startMs: number): number {
  try {
    return Math.max(0, nowMs() - startMs);
  } catch {
    return 0;
  }
}
