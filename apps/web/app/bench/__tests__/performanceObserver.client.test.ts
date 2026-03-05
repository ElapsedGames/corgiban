import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearBenchPerformanceEntries,
  observeBenchPerformance,
} from '../performanceObserver.client';
import type { PerformanceObserverApis } from '../performanceObserver.client';

describe('observeBenchPerformance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a no-op disposer when PerformanceObserver is unavailable', () => {
    const onEntries = vi.fn();
    const stop = observeBenchPerformance(onEntries, {
      PerformanceObserverImpl: undefined,
    });

    stop();
    expect(onEntries).not.toHaveBeenCalled();
  });

  it('observes measure entries with buffered type mode and forwards only bench:* names', () => {
    const disconnect = vi.fn();
    const observe = vi.fn();

    class FakeObserver {
      readonly callback: (entryList: { getEntries: () => PerformanceEntry[] }) => void;

      constructor(callback: (entryList: { getEntries: () => PerformanceEntry[] }) => void) {
        this.callback = callback;
      }

      observe(options: { entryTypes?: string[]; type?: string; buffered?: boolean }) {
        observe(options);
        this.callback({
          getEntries: () =>
            [
              {
                name: 'bench:solve-roundtrip:run-1',
                entryType: 'measure',
                startTime: 1,
                duration: 2,
              },
              {
                name: 'other:event',
                entryType: 'measure',
                startTime: 3,
                duration: 4,
              },
            ] as PerformanceEntry[],
        });
      }

      disconnect() {
        disconnect();
      }
    }

    const onEntries = vi.fn();
    const stop = observeBenchPerformance(onEntries, {
      PerformanceObserverImpl: FakeObserver as unknown as NonNullable<
        PerformanceObserverApis['PerformanceObserverImpl']
      >,
    });

    expect(observe).toHaveBeenCalledWith({
      type: 'measure',
      buffered: true,
    });
    expect(onEntries).toHaveBeenCalledTimes(1);
    expect(onEntries).toHaveBeenCalledWith([
      {
        name: 'bench:solve-roundtrip:run-1',
        entryType: 'measure',
        startTime: 1,
        duration: 2,
      },
    ]);

    stop();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to entryTypes when type-based observe throws', () => {
    const observe = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new TypeError('unsupported');
      })
      .mockImplementationOnce(() => {
        throw new TypeError('unsupported');
      })
      .mockImplementationOnce(() => undefined);

    class FallbackObserver {
      observe(options: { entryTypes?: string[]; type?: string; buffered?: boolean }) {
        observe(options);
      }

      disconnect() {
        return;
      }
    }

    const stop = observeBenchPerformance(vi.fn(), {
      PerformanceObserverImpl: FallbackObserver as unknown as NonNullable<
        PerformanceObserverApis['PerformanceObserverImpl']
      >,
    });

    expect(observe).toHaveBeenNthCalledWith(1, {
      type: 'measure',
      buffered: true,
    });
    expect(observe).toHaveBeenNthCalledWith(2, {
      type: 'measure',
    });
    expect(observe).toHaveBeenNthCalledWith(3, {
      entryTypes: ['measure'],
    });

    stop();
  });

  it('does not call onEntries when observer callback has no bench entries', () => {
    class EmptyObserver {
      readonly callback: (entryList: { getEntries: () => PerformanceEntry[] }) => void;

      constructor(callback: (entryList: { getEntries: () => PerformanceEntry[] }) => void) {
        this.callback = callback;
      }

      observe() {
        this.callback({
          getEntries: () =>
            [
              {
                name: 'unrelated:metric',
                entryType: 'measure',
                startTime: 0,
                duration: 1,
              },
            ] as PerformanceEntry[],
        });
      }

      disconnect() {
        return;
      }
    }

    const onEntries = vi.fn();
    observeBenchPerformance(onEntries, {
      PerformanceObserverImpl: EmptyObserver as unknown as NonNullable<
        PerformanceObserverApis['PerformanceObserverImpl']
      >,
    });

    expect(onEntries).not.toHaveBeenCalled();
  });

  it('returns a no-op disposer when global PerformanceObserver is unavailable', () => {
    vi.stubGlobal('PerformanceObserver', undefined);

    const onEntries = vi.fn();
    const stop = observeBenchPerformance(onEntries);

    expect(() => stop()).not.toThrow();
    expect(onEntries).not.toHaveBeenCalled();
  });

  it('clears only bench:* marks and measures from the performance timeline', () => {
    const clearMarks = vi.fn();
    const clearMeasures = vi.fn();
    const timeline = {
      getEntriesByType: vi.fn((entryType: string) => {
        if (entryType === 'measure') {
          return [
            { name: 'bench:solve-roundtrip:run-1' },
            { name: 'other:measure' },
            { name: 'bench:solve-roundtrip:run-1' },
          ] as PerformanceEntry[];
        }

        return [
          { name: 'bench:solve-dispatch:run-1' },
          { name: 'other:mark' },
        ] as PerformanceEntry[];
      }),
      clearMarks,
      clearMeasures,
    };

    clearBenchPerformanceEntries(timeline);

    expect(clearMeasures).toHaveBeenCalledTimes(1);
    expect(clearMeasures).toHaveBeenCalledWith('bench:solve-roundtrip:run-1');
    expect(clearMarks).toHaveBeenCalledTimes(1);
    expect(clearMarks).toHaveBeenCalledWith('bench:solve-dispatch:run-1');
  });

  it('swallows timeline API errors when clearing bench performance entries', () => {
    const timeline = {
      getEntriesByType: vi.fn(() => {
        throw new Error('unsupported');
      }),
      clearMarks: vi.fn(() => {
        throw new Error('mark clear failed');
      }),
      clearMeasures: vi.fn(() => {
        throw new Error('measure clear failed');
      }),
    };

    expect(() => clearBenchPerformanceEntries(timeline)).not.toThrow();
  });
});
