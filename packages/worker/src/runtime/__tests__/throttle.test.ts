import { describe, expect, it } from 'vitest';

import { createProgressThrottle } from '../throttle';

describe('createProgressThrottle', () => {
  it('emits on the first snapshot and when forced', () => {
    const throttle = createProgressThrottle({ minIntervalMs: 100, minExpandedDelta: 100 });

    expect(throttle.shouldEmit({ elapsedMs: 0, expanded: 0 })).toBe(true);
    expect(throttle.shouldEmit({ elapsedMs: 0, expanded: 0 }, true)).toBe(true);
  });

  it('emits once the elapsed threshold is met', () => {
    const throttle = createProgressThrottle({ minIntervalMs: 50, minExpandedDelta: 1000 });

    expect(throttle.shouldEmit({ elapsedMs: 0, expanded: 0 })).toBe(true);
    expect(throttle.shouldEmit({ elapsedMs: 20, expanded: 1 })).toBe(false);
    expect(throttle.shouldEmit({ elapsedMs: 60, expanded: 2 })).toBe(true);
  });

  it('emits once the expanded threshold is met', () => {
    const throttle = createProgressThrottle({ minIntervalMs: 1000, minExpandedDelta: 5 });

    expect(throttle.shouldEmit({ elapsedMs: 0, expanded: 0 })).toBe(true);
    expect(throttle.shouldEmit({ elapsedMs: 10, expanded: 3 })).toBe(false);
    expect(throttle.shouldEmit({ elapsedMs: 20, expanded: 6 })).toBe(true);
  });

  it('resets internal state to allow a fresh emission', () => {
    const throttle = createProgressThrottle({ minIntervalMs: 100, minExpandedDelta: 100 });

    expect(throttle.shouldEmit({ elapsedMs: 0, expanded: 0 })).toBe(true);
    expect(throttle.shouldEmit({ elapsedMs: 10, expanded: 1 })).toBe(false);

    throttle.reset();

    expect(throttle.shouldEmit({ elapsedMs: 0, expanded: 0 })).toBe(true);
  });
});
