import type { SolverProgress } from '../api/solverTypes';

export type ProgressThrottleOptions = {
  throttleMs?: number;
  minExpandedDelta?: number;
};

export type ProgressReporter = {
  report: (progress: SolverProgress) => void;
  flush: (progress: SolverProgress) => void;
};

export const DEFAULT_PROGRESS_THROTTLE_MS = 100;
export const DEFAULT_PROGRESS_EXPANDED_INTERVAL = 100;

export function createProgressReporter(
  onProgress: ((progress: SolverProgress) => void) | undefined,
  options?: ProgressThrottleOptions,
): ProgressReporter {
  const throttleMs = Math.max(0, options?.throttleMs ?? DEFAULT_PROGRESS_THROTTLE_MS);
  const minExpandedDelta = Math.max(
    0,
    options?.minExpandedDelta ?? DEFAULT_PROGRESS_EXPANDED_INTERVAL,
  );
  let hasReported = false;
  let lastReportedMs = 0;
  let lastReportedExpanded = 0;

  const shouldReport = (progress: SolverProgress): boolean => {
    if (!onProgress) {
      return false;
    }
    if (!hasReported) {
      return progress.elapsedMs >= throttleMs || progress.expanded >= minExpandedDelta;
    }
    const elapsedDelta = progress.elapsedMs - lastReportedMs;
    const expandedDelta = progress.expanded - lastReportedExpanded;
    return elapsedDelta >= throttleMs || expandedDelta >= minExpandedDelta;
  };

  const record = (progress: SolverProgress): void => {
    hasReported = true;
    lastReportedMs = progress.elapsedMs;
    lastReportedExpanded = progress.expanded;
  };

  return {
    report(progress: SolverProgress) {
      if (!onProgress) {
        return;
      }
      if (!shouldReport(progress)) {
        return;
      }
      record(progress);
      onProgress(progress);
    },
    flush(progress: SolverProgress) {
      if (!onProgress) {
        return;
      }
      record(progress);
      onProgress(progress);
    },
  };
}
