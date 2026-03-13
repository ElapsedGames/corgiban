import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveNowMs, safeElapsedMs } from '../clock';

describe('solver api clock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers an explicit context clock over global performance.now', () => {
    const contextNowMs = vi.fn(() => 123);
    vi.stubGlobal('performance', {
      now: vi.fn(() => 999),
    });

    const resolved = resolveNowMs({ nowMs: contextNowMs });

    expect(resolved).toBe(contextNowMs);
    expect(resolved?.()).toBe(123);
  });

  it('falls back to performance.now when no context clock is provided', () => {
    const now = vi.fn(() => 42);
    vi.stubGlobal('performance', { now });

    const resolved = resolveNowMs({});

    expect(resolved).not.toBeNull();
    expect(resolved?.()).toBe(42);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('returns null when no monotonic clock source is available', () => {
    vi.stubGlobal('performance', undefined);

    expect(resolveNowMs({})).toBeNull();
  });

  it('clamps negative elapsed times to zero', () => {
    expect(safeElapsedMs(() => 8, 10)).toBe(0);
  });

  it('returns zero when the clock callback throws', () => {
    expect(
      safeElapsedMs(() => {
        throw new Error('boom');
      }, 5),
    ).toBe(0);
  });
});
