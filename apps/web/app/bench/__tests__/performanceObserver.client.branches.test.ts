import { describe, expect, it, vi } from 'vitest';

import { clearBenchPerformanceEntries } from '../performanceObserver.client';

describe('clearBenchPerformanceEntries branch coverage', () => {
  it('returns immediately when no performance timeline is available', () => {
    expect(() => clearBenchPerformanceEntries(undefined)).not.toThrow();
  });

  it('continues clearing mark entries when measure cleanup throws', () => {
    const clearMeasures = vi.fn(() => {
      throw new Error('measure clear failed');
    });
    const clearMarks = vi.fn();
    const timeline = {
      getEntriesByType: vi.fn((entryType: string) => {
        if (entryType === 'measure') {
          return [{ name: 'bench:solve-roundtrip:run-1' }] as PerformanceEntry[];
        }

        return [{ name: 'bench:solve-dispatch:run-1' }] as PerformanceEntry[];
      }),
      clearMarks,
      clearMeasures,
    };

    expect(() => clearBenchPerformanceEntries(timeline)).not.toThrow();
    expect(clearMeasures).toHaveBeenCalledWith('bench:solve-roundtrip:run-1');
    expect(clearMarks).toHaveBeenCalledWith('bench:solve-dispatch:run-1');
  });

  it('continues after mark cleanup throws once measures were already cleared', () => {
    const clearMeasures = vi.fn();
    const clearMarks = vi.fn(() => {
      throw new Error('mark clear failed');
    });
    const timeline = {
      getEntriesByType: vi.fn((entryType: string) => {
        if (entryType === 'measure') {
          return [{ name: 'bench:solve-roundtrip:run-2' }] as PerformanceEntry[];
        }

        return [{ name: 'bench:solve-dispatch:run-2' }] as PerformanceEntry[];
      }),
      clearMarks,
      clearMeasures,
    };

    expect(() => clearBenchPerformanceEntries(timeline)).not.toThrow();
    expect(clearMeasures).toHaveBeenCalledWith('bench:solve-roundtrip:run-2');
    expect(clearMarks).toHaveBeenCalledWith('bench:solve-dispatch:run-2');
  });
});
