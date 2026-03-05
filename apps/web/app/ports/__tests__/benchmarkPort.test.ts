import { describe, expect, it } from 'vitest';

import { BenchmarkRunCancelledError, createNoopBenchmarkPort } from '../benchmarkPort';

describe('benchmarkPort types and no-op adapter', () => {
  it('creates BenchmarkRunCancelledError with default and custom messages', () => {
    const defaultError = new BenchmarkRunCancelledError();
    expect(defaultError.name).toBe('BenchmarkRunCancelledError');
    expect(defaultError.message).toBe('Benchmark run cancelled.');

    const customError = new BenchmarkRunCancelledError('Cancelled by user');
    expect(customError.message).toBe('Cancelled by user');
  });

  it('creates a no-op benchmark port that rejects runSuite and no-ops cancellation/disposal', async () => {
    const port = createNoopBenchmarkPort();

    await expect(
      port.runSuite({
        suiteRunId: 'suite-noop',
        suite: {
          levelIds: ['level-1'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1000,
          nodeBudget: 5000,
        },
        levelResolver: () => {
          throw new Error('not used');
        },
      }),
    ).rejects.toThrow('Benchmark worker is unavailable in this environment.');

    expect(() => port.cancelSuite('suite-noop')).not.toThrow();
    expect(() => port.dispose()).not.toThrow();
  });
});
