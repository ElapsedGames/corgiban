import { afterEach, describe, expect, it, vi } from 'vitest';

describe('createBenchmarkPort worker URL guards', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('../benchmarkWorker.client.ts?worker&url');
    vi.resetModules();
  });

  it('throws when the benchmark worker URL resolves to an empty string', async () => {
    vi.doMock('../benchmarkWorker.client.ts?worker&url', () => ({
      default: '',
    }));
    vi.stubGlobal(
      'Worker',
      class WorkerMock {
        constructor(_url: string, _options?: { type?: 'module'; name?: string }) {}
      },
    );

    const { createBenchmarkPort } = await import('../benchmarkPort.client');
    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: {
        userAgent: 'BenchTest',
        hardwareConcurrency: 8,
      },
    });

    await expect(
      port.runSuite({
        suiteRunId: 'bench-empty-url',
        suite: {
          levelIds: ['corgiban-test-18'],
          algorithmIds: ['bfsPush'],
          repetitions: 1,
          timeBudgetMs: 1_000,
          nodeBudget: 5_000,
        },
        levelResolver: () => ({
          levelId: 'corgiban-test-18',
          width: 1,
          height: 1,
          staticGrid: new Uint8Array([0]),
          initialPlayerIndex: 0,
          initialBoxes: new Uint32Array([]),
        }),
      }),
    ).rejects.toThrow('Benchmark worker URL resolved to an empty string.');
  });
});
