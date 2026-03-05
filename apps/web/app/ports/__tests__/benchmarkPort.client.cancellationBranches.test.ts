import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  BenchmarkClient,
  BenchmarkClientRunCallbacks,
  BenchmarkClientRunRequest,
  BenchResultMessage,
} from '@corgiban/worker';

function createLevelRuntime() {
  return {
    levelId: 'classic-001',
    width: 1,
    height: 1,
    staticGrid: new Uint8Array([0]),
    initialPlayerIndex: 0,
    initialBoxes: new Uint32Array([]),
  };
}

describe('createBenchmarkPort cancellation coverage branches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('@corgiban/worker');
    vi.doUnmock('../benchmarkWorker.client.ts?worker&url');
    vi.resetModules();
  });

  async function createHarness() {
    // Controllable benchmark client: runSuite hangs until cancelSuite or settle is called.
    type HarnessClient = BenchmarkClient & {
      settle: (results: BenchResultMessage[]) => void;
    };

    vi.doMock('@corgiban/worker', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@corgiban/worker')>();

      return {
        ...actual,
        createBenchmarkClient: vi.fn((): HarnessClient => {
          let rejectSuite: (e: Error) => void = () => undefined;
          let resolveSuite: (r: BenchResultMessage[]) => void = () => undefined;

          return {
            runSuite: vi.fn(
              async (_request: {
                runs: BenchmarkClientRunRequest[];
                callbacks?: BenchmarkClientRunCallbacks;
              }) =>
                new Promise<BenchResultMessage[]>((resolve, reject) => {
                  resolveSuite = resolve;
                  rejectSuite = reject;
                }),
            ),
            cancel: vi.fn(() => false),
            cancelSuite: vi.fn(() => {
              rejectSuite(new Error('Benchmark suite cancelled.'));
            }),
            dispose: vi.fn(),
            getPoolSize: vi.fn(() => 1),
            settle(results: BenchResultMessage[]) {
              resolveSuite(results);
            },
          };
        }),
      };
    });

    vi.doMock('../benchmarkWorker.client.ts?worker&url', () => ({
      default: '/app/ports/benchmarkWorker.client.ts?worker_file&type=module',
    }));

    vi.stubGlobal(
      'Worker',
      class WorkerMock {
        constructor(_url: string, _options?: { type?: 'module'; name?: string }) {}
      },
    );

    const { createBenchmarkPort } = await import('../benchmarkPort.client');

    return { createBenchmarkPort };
  }

  it('throws BenchmarkRunCancelledError when cancelSuite is called while suite runs', async () => {
    const harness = await createHarness();
    const port = harness.createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
      performanceApi: { mark: vi.fn(), measure: vi.fn() },
    });

    const runPromise = port.runSuite({
      suiteRunId: 'bench-cancel-during-run',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => createLevelRuntime(),
    });

    await Promise.resolve();
    port.cancelSuite('bench-cancel-during-run');

    await expect(runPromise).rejects.toMatchObject({
      name: 'BenchmarkRunCancelledError',
    });
  });

  it('does not dispatch onResult callbacks after suite is cancelled', async () => {
    vi.doMock('@corgiban/worker', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@corgiban/worker')>();

      return {
        ...actual,
        createBenchmarkClient: vi.fn(
          (): BenchmarkClient => ({
            runSuite: vi.fn(
              async (request: {
                runs: BenchmarkClientRunRequest[];
                callbacks?: BenchmarkClientRunCallbacks;
              }) => {
                // Yield one microtask so that cancelSuite() can set the cancelled flag
                // before onResult fires. This simulates the real async delivery path.
                await Promise.resolve();
                // Simulate a single result arriving after the suite was already cancelled.
                // The onResult in the port should be a no-op when cancelled=true.
                for (const run of request.runs) {
                  request.callbacks?.onResult?.(
                    {
                      type: 'BENCH_RESULT',
                      runId: run.runId,
                      protocolVersion: 2,
                      status: 'solved',
                      metrics: {
                        elapsedMs: 1,
                        expanded: 1,
                        generated: 1,
                        maxDepth: 1,
                        maxFrontier: 1,
                        pushCount: 1,
                        moveCount: 1,
                      },
                      solutionMoves: 'R',
                    },
                    run,
                  );
                }
                // After delivering the result, throw as if the pool was cancelled.
                throw new Error('Benchmark suite cancelled.');
              },
            ),
            cancel: vi.fn(() => false),
            cancelSuite: vi.fn(),
            dispose: vi.fn(),
            getPoolSize: vi.fn(() => 1),
          }),
        ),
      };
    });

    vi.doMock('../benchmarkWorker.client.ts?worker&url', () => ({
      default: '/app/ports/benchmarkWorker.client.ts?worker_file&type=module',
    }));

    vi.stubGlobal(
      'Worker',
      class WorkerMock {
        constructor(_url: string, _options?: { type?: 'module'; name?: string }) {}
      },
    );

    const { createBenchmarkPort } = await import('../benchmarkPort.client');

    const onResult = vi.fn();
    const port = createBenchmarkPort({
      concurrency: 1,
      navigatorLike: { userAgent: 'BenchTest', hardwareConcurrency: 8 },
    });

    // Cancel before runSuite so suiteRef.cancelled is set to true immediately.
    // We simulate this by cancelling once the suite ID is known via suiteRunId.
    const runPromise = port.runSuite({
      suiteRunId: 'bench-cancel-skip-result',
      suite: {
        levelIds: ['classic-001'],
        algorithmIds: ['bfsPush'],
        repetitions: 1,
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      levelResolver: () => createLevelRuntime(),
      onResult,
    });

    // Cancel before the runSuite microtasks flush, so the cancelled flag is true when
    // the mock's onResult fires synchronously inside client.runSuite().
    port.cancelSuite('bench-cancel-skip-result');

    await expect(runPromise).rejects.toMatchObject({ name: 'BenchmarkRunCancelledError' });
    // onResult must not have been called because the port skips it when cancelled.
    expect(onResult).not.toHaveBeenCalled();
  });
});
