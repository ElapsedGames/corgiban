export type ProgressSnapshot = {
  elapsedMs: number;
  expanded: number;
};

export type ProgressThrottleOptions = {
  minIntervalMs?: number;
  minExpandedDelta?: number;
};

export type ProgressThrottle = {
  shouldEmit: (snapshot: ProgressSnapshot, force?: boolean) => boolean;
  reset: () => void;
};

export const DEFAULT_PROGRESS_INTERVAL_MS = 100;
export const DEFAULT_PROGRESS_EXPANDED_DELTA = 100;

export function createProgressThrottle(options?: ProgressThrottleOptions): ProgressThrottle {
  const minIntervalMs = Math.max(0, options?.minIntervalMs ?? DEFAULT_PROGRESS_INTERVAL_MS);
  const minExpandedDelta = Math.max(
    0,
    options?.minExpandedDelta ?? DEFAULT_PROGRESS_EXPANDED_DELTA,
  );

  let initialized = false;
  let lastElapsedMs = 0;
  let lastExpanded = 0;

  const remember = (snapshot: ProgressSnapshot) => {
    initialized = true;
    lastElapsedMs = snapshot.elapsedMs;
    lastExpanded = snapshot.expanded;
  };

  return {
    shouldEmit(snapshot, force = false) {
      if (force || !initialized) {
        remember(snapshot);
        return true;
      }

      const elapsedDelta = snapshot.elapsedMs - lastElapsedMs;
      const expandedDelta = snapshot.expanded - lastExpanded;
      if (elapsedDelta >= minIntervalMs || expandedDelta >= minExpandedDelta) {
        remember(snapshot);
        return true;
      }

      return false;
    },
    reset() {
      initialized = false;
      lastElapsedMs = 0;
      lastExpanded = 0;
    },
  };
}
