import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('makeRunId', () => {
  it('uses crypto.randomUUID when it succeeds', async () => {
    const randomUUID = vi.fn().mockReturnValue('uuid-123');
    vi.stubGlobal('crypto', { randomUUID });
    const { makeRunId } = await import('../runId');

    expect(makeRunId('bench')).toBe('bench-uuid-123');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timestamp-plus-counter suffix when randomUUID throws', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => {
        throw new Error('unsupported');
      }),
    });
    vi.spyOn(Date, 'now').mockReturnValue(12_345);
    const { makeRunId } = await import('../runId');

    expect(makeRunId('bench')).toBe('bench-12345-0');
  });

  it('keeps fallback run ids unique within the same mocked millisecond', async () => {
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn(() => {
        throw new Error('unsupported');
      }),
    });
    vi.spyOn(Date, 'now').mockReturnValue(12_345);
    const { makeRunId } = await import('../runId');

    const ids = [makeRunId('bench'), makeRunId('bench'), makeRunId('bench')];

    expect(ids).toEqual(['bench-12345-0', 'bench-12345-1', 'bench-12345-2']);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
