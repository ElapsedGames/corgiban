import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const solveMock = vi.fn();

vi.mock('@corgiban/solver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@corgiban/solver')>();
  return {
    ...actual,
    solve: (...args: unknown[]) => solveMock(...args),
  };
});

type MessageListener = (event: { data: unknown }) => void;

async function setupWorkerHarness(options?: { performanceNow?: (() => number) | null }) {
  const messages: unknown[] = [];
  let listener: MessageListener | null = null;

  vi.stubGlobal('addEventListener', (type: string, cb: MessageListener) => {
    if (type === 'message') {
      listener = cb;
    }
  });
  vi.stubGlobal('postMessage', (message: unknown) => {
    messages.push(message);
  });
  if (options?.performanceNow === null) {
    vi.stubGlobal('performance', undefined);
  } else if (options?.performanceNow) {
    vi.stubGlobal('performance', {
      now: options.performanceNow,
    });
  }

  await import('../benchmarkWorker');

  if (!listener) {
    throw new Error('Worker message listener was not registered.');
  }

  return {
    messages,
    emit: (data: unknown) => {
      listener?.({ data });
    },
  };
}

const sampleLevelRuntime = {
  levelId: 'test-level',
  width: 3,
  height: 3,
  staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
  initialPlayerIndex: 4,
  initialBoxes: Uint32Array.from([5]),
};

describe('benchmarkWorker runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    solveMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('responds to PING with PONG', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({ type: 'PING', protocolVersion: 2 });

    expect(harness.messages[0]).toEqual({
      type: 'PONG',
      protocolVersion: 2,
    });
  });

  it('rejects invalid inbound messages with SOLVE_ERROR', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({ type: 'BENCH_START', protocolVersion: 2 });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'invalid-run',
      protocolVersion: 2,
      message: 'Invalid inbound protocol message.',
    });
  });

  it('runs BENCH_START and emits only BENCH_RESULT without spectator stream', async () => {
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks) => {
      // Solver calls onProgress - should be suppressed without enableSpectatorStream.
      hooks?.onProgress?.({
        expanded: 3,
        generated: 4,
        depth: 1,
        frontier: 1,
        elapsedMs: 10,
        bestHeuristic: 5,
      });
      return {
        status: 'solved',
        solutionMoves: 'R',
        metrics: {
          elapsedMs: 10,
          expanded: 3,
          generated: 4,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 1,
          moveCount: 1,
        },
      };
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-1',
      benchmarkCaseId: 'case-1',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(
      harness.messages.filter((m) => (m as { type?: string }).type === 'BENCH_PROGRESS'),
    ).toHaveLength(0);

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_RESULT',
      runId: 'bench-1',
      benchmarkCaseId: 'case-1',
      protocolVersion: 2,
      status: 'solved',
      solutionMoves: 'R',
    });
  });

  it('streams bestPathSoFar when spectator stream is enabled', async () => {
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks) => {
      hooks?.onProgress?.({
        expanded: 1,
        generated: 1,
        depth: 0,
        frontier: 0,
        elapsedMs: 1,
        bestPathSoFar: 'LL',
      });
      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 1,
          expanded: 1,
          generated: 1,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-2',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: { enableSpectatorStream: true },
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_PROGRESS',
      runId: 'bench-2',
      protocolVersion: 2,
      bestPathSoFar: 'LL',
    });
  });

  it('includes bestHeuristic and benchmarkCaseId in spectator progress payloads', async () => {
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks) => {
      hooks?.onProgress?.({
        expanded: 2,
        generated: 3,
        depth: 1,
        frontier: 1,
        elapsedMs: 4,
        bestHeuristic: 9,
        bestPathSoFar: 'RR',
      });
      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 4,
          expanded: 2,
          generated: 3,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-progress-shape',
      benchmarkCaseId: 'case-progress-shape',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: { enableSpectatorStream: true },
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_PROGRESS',
      runId: 'bench-progress-shape',
      protocolVersion: 2,
      benchmarkCaseId: 'case-progress-shape',
      bestHeuristic: 9,
      bestPathSoFar: 'RR',
    });
  });

  it('passes spectator throttling context to solver and forwards BENCH_PROGRESS callbacks', async () => {
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks) => {
      hooks?.onProgress?.({
        expanded: 1,
        generated: 1,
        depth: 0,
        frontier: 0,
        elapsedMs: 1,
      });
      hooks?.onProgress?.({
        expanded: 2,
        generated: 2,
        depth: 0,
        frontier: 0,
        elapsedMs: 2,
      });

      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 2,
          expanded: 2,
          generated: 2,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-throttle',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: { enableSpectatorStream: true },
    });

    expect(
      harness.messages.filter(
        (message) => (message as { type?: string }).type === 'BENCH_PROGRESS',
      ),
    ).toHaveLength(2);

    const solveContext = solveMock.mock.calls[0]?.[4] as
      | {
          progressThrottleMs?: number;
          progressExpandedInterval?: number;
        }
      | undefined;
    expect(solveContext?.progressThrottleMs).toBe(100);
    expect(solveContext?.progressExpandedInterval).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('emits BENCH_RESULT status error for solver domain failures', async () => {
    solveMock.mockImplementation(() => ({
      status: 'error',
      errorMessage: 'Domain benchmark failure.',
      errorDetails: 'No heuristic available.',
      metrics: {
        elapsedMs: 0,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    }));

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-3',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_RESULT',
      runId: 'bench-3',
      protocolVersion: 2,
      status: 'error',
      errorMessage: 'Domain benchmark failure.',
      errorDetails: 'No heuristic available.',
    });
  });

  it('propagates benchmarkCaseId on BENCH_RESULT error payloads', async () => {
    solveMock.mockImplementation(() => ({
      status: 'error',
      errorMessage: 'Case-scoped domain failure.',
      metrics: {
        elapsedMs: 0,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    }));

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-error-case',
      benchmarkCaseId: 'case-error',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_RESULT',
      runId: 'bench-error-case',
      benchmarkCaseId: 'case-error',
      protocolVersion: 2,
      status: 'error',
      errorMessage: 'Case-scoped domain failure.',
    });
  });

  it('omits optional BENCH_RESULT fields when solver does not provide them', async () => {
    solveMock.mockImplementation(() => ({
      status: 'error',
      errorMessage: 'Domain benchmark failure.',
      metrics: {
        elapsedMs: 0,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    }));

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-optional-fields',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_RESULT',
      runId: 'bench-optional-fields',
      protocolVersion: 2,
      status: 'error',
      errorMessage: 'Domain benchmark failure.',
    });
    expect((harness.messages[0] as { errorDetails?: string }).errorDetails).toBeUndefined();
    expect((harness.messages[0] as { benchmarkCaseId?: string }).benchmarkCaseId).toBeUndefined();
  });

  it('emits SOLVE_ERROR when benchmark solve throws', async () => {
    solveMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-4',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'bench-4',
      protocolVersion: 2,
      message: 'Failed to execute benchmark run.',
      details: 'boom',
    });
  });

  it('uses fallback details when benchmark solve throws a non-Error value', async () => {
    solveMock.mockImplementation(() => {
      throw 'non-error';
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-non-error',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'bench-non-error',
      protocolVersion: 2,
      message: 'Failed to execute benchmark run.',
      details: 'Unknown benchmark worker failure.',
    });
  });

  it('does not inject a non-monotonic clock when performance.now is unavailable', async () => {
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, _hooks, context) => {
      expect(context.nowMs).toBeUndefined();
      return {
        status: 'error',
        metrics: {
          elapsedMs: 0,
          expanded: 0,
          generated: 0,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
        errorMessage:
          'Solver clock source unavailable. Pass context.nowMs when performance.now is unavailable.',
      };
    });

    const harness = await setupWorkerHarness({ performanceNow: null });

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-no-performance',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_RESULT',
      runId: 'bench-no-performance',
      protocolVersion: 2,
      status: 'error',
      errorMessage:
        'Solver clock source unavailable. Pass context.nowMs when performance.now is unavailable.',
    });
  });

  it('uses performance.now when available for solve context timing', async () => {
    const nowSpy = vi.fn(() => 123);
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, _hooks, context) => {
      expect(context.nowMs()).toBe(123);
      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 0,
          expanded: 0,
          generated: 0,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness({ performanceNow: nowSpy });

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-with-performance',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(nowSpy).toHaveBeenCalled();
    expect(harness.messages[0]).toMatchObject({
      type: 'BENCH_RESULT',
      runId: 'bench-with-performance',
      protocolVersion: 2,
      status: 'unsolved',
    });
  });

  it('ignores stale progress and final result when a re-entrant run replaces activeRun', async () => {
    let emit: ((data: unknown) => void) | null = null;
    let emittedInnerRun = false;
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks, _context) => {
      if (emit && !emittedInnerRun) {
        emittedInnerRun = true;
        emit({
          type: 'BENCH_START',
          runId: 'bench-inner',
          protocolVersion: 2,
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
        });
      }

      hooks?.onProgress?.({
        expanded: 1,
        generated: 1,
        depth: 0,
        frontier: 0,
        elapsedMs: 1,
      });

      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 1,
          expanded: 1,
          generated: 1,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness();
    emit = harness.emit;

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-outer',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    const resultRunIds = harness.messages
      .filter((message): message is { type: string; runId?: string } => Boolean(message))
      .filter((message) => message.type === 'BENCH_RESULT')
      .map((message) => message.runId);

    expect(resultRunIds).toContain('bench-inner');
    expect(resultRunIds).not.toContain('bench-outer');
  });

  it('suppresses spectator progress from stale runs after activeRun is replaced', async () => {
    let emit: ((data: unknown) => void) | null = null;
    let emittedInnerRun = false;
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks, _context) => {
      if (emit && !emittedInnerRun) {
        emittedInnerRun = true;
        emit({
          type: 'BENCH_START',
          runId: 'bench-inner-stream',
          protocolVersion: 2,
          levelRuntime: sampleLevelRuntime,
          algorithmId: 'bfsPush',
          options: { enableSpectatorStream: true },
        });
      }

      hooks?.onProgress?.({
        expanded: 1,
        generated: 1,
        depth: 0,
        frontier: 0,
        elapsedMs: 1,
        bestPathSoFar: 'U',
      });

      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 1,
          expanded: 1,
          generated: 1,
          maxDepth: 0,
          maxFrontier: 0,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness();
    emit = harness.emit;

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-outer-stream',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: { enableSpectatorStream: true },
    });

    const progressRunIds = harness.messages
      .filter(
        (message): message is { type: string; runId?: string } =>
          Boolean(message) && typeof message === 'object',
      )
      .filter((message) => message.type === 'BENCH_PROGRESS')
      .map((message) => message.runId);

    expect(progressRunIds).toContain('bench-inner-stream');
    expect(progressRunIds).not.toContain('bench-outer-stream');
  });

  it('treats SOLVE_START as unsupported for benchmark runtime', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'solve-1',
      protocolVersion: 2,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'solve-1',
      protocolVersion: 2,
      message: 'Unsupported inbound message SOLVE_START for benchmark worker.',
    });
  });

  it('uses runId from invalid payloads when available', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-invalid',
      protocolVersion: 2,
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'bench-invalid',
      protocolVersion: 2,
      message: 'Invalid inbound protocol message.',
    });
  });
});
