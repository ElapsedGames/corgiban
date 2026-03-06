type RuntimeClockScope = {
  performance?: {
    now: () => number;
  };
};

export function createRuntimeNowMs(scope: RuntimeClockScope): (() => number) | undefined {
  const perf = scope.performance;
  if (perf && typeof perf.now === 'function') {
    return () => perf.now();
  }

  return undefined;
}
