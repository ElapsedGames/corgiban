export type ObservedPerformanceEntry = {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;
};

type PerformanceEntryListLike = {
  getEntries: () => PerformanceEntry[];
};

type PerformanceObserverLike = {
  observe: (options: { entryTypes?: string[]; type?: string; buffered?: boolean }) => void;
  disconnect: () => void;
};

type PerformanceObserverCtor = new (
  callback: (entryList: PerformanceEntryListLike) => void,
) => PerformanceObserverLike;

export type PerformanceObserverApis = {
  PerformanceObserverImpl?: PerformanceObserverCtor;
};

type PerformanceTimelineApi = Pick<
  Performance,
  'getEntriesByType' | 'clearMarks' | 'clearMeasures'
>;

type ObserveOptions = {
  entryTypes?: string[];
  type?: string;
  buffered?: boolean;
};

function mapEntries(entries: PerformanceEntry[]): ObservedPerformanceEntry[] {
  return entries.map((entry) => ({
    name: entry.name,
    entryType: entry.entryType,
    startTime: entry.startTime,
    duration: entry.duration,
  }));
}

function readBenchEntryNames(
  timeline: PerformanceTimelineApi,
  entryType: 'mark' | 'measure',
): string[] {
  try {
    return timeline
      .getEntriesByType(entryType)
      .map((entry) => entry.name)
      .filter((name) => name.startsWith('bench:'));
  } catch {
    return [];
  }
}

export function clearBenchPerformanceEntries(
  timeline: PerformanceTimelineApi | undefined = globalThis.performance,
): void {
  if (!timeline) {
    return;
  }

  const measureNames = new Set(readBenchEntryNames(timeline, 'measure'));
  const markNames = new Set(readBenchEntryNames(timeline, 'mark'));

  measureNames.forEach((name) => {
    try {
      timeline.clearMeasures(name);
    } catch {
      // Best-effort cleanup; keep clear action resilient in unsupported environments.
    }
  });

  markNames.forEach((name) => {
    try {
      timeline.clearMarks(name);
    } catch {
      // Best-effort cleanup; keep clear action resilient in unsupported environments.
    }
  });
}

export function observeBenchPerformance(
  onEntries: (entries: ObservedPerformanceEntry[]) => void,
  apis: PerformanceObserverApis = {},
): () => void {
  const PerformanceObserverImpl =
    apis.PerformanceObserverImpl ??
    (globalThis as unknown as { PerformanceObserver?: PerformanceObserverCtor })
      .PerformanceObserver;

  if (typeof PerformanceObserverImpl !== 'function') {
    return () => undefined;
  }

  const observer = new PerformanceObserverImpl((entryList) => {
    const entries = mapEntries(entryList.getEntries()).filter((entry) =>
      entry.name.startsWith('bench:'),
    );

    if (entries.length > 0) {
      onEntries(entries);
    }
  });

  const observeAttempts: ObserveOptions[] = [
    { type: 'measure', buffered: true },
    { type: 'measure' },
    { entryTypes: ['measure'] },
  ];

  for (const options of observeAttempts) {
    try {
      observer.observe(options);
      break;
    } catch {
      continue;
    }
  }

  return () => {
    observer.disconnect();
  };
}
