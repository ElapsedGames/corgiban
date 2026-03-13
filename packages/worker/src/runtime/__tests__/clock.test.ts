import { describe, expect, it, vi } from 'vitest';

import { createRuntimeNowMs } from '../clock';

describe('createRuntimeNowMs', () => {
  it('wraps performance.now when it is available', () => {
    const now = vi.fn(() => 17);

    const runtimeNowMs = createRuntimeNowMs({
      performance: { now },
    });

    expect(runtimeNowMs).toBeTypeOf('function');
    expect(runtimeNowMs?.()).toBe(17);
    expect(now).toHaveBeenCalledTimes(1);
  });

  it('returns undefined when performance is missing', () => {
    expect(createRuntimeNowMs({})).toBeUndefined();
  });

  it('returns undefined when performance.now is not callable', () => {
    expect(
      createRuntimeNowMs({
        performance: {
          now: 123 as unknown as () => number,
        },
      }),
    ).toBeUndefined();
  });
});
