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

async function setupWorkerHarness() {
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

  await import('../solverWorker');

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

describe('solverWorker runtime', () => {
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
  }, 15_000);

  it('rejects invalid inbound messages with SOLVE_ERROR', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({ type: 'SOLVE_START', protocolVersion: 2 });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'invalid-run',
      protocolVersion: 2,
      message: 'Invalid inbound protocol message.',
    });
  });

  it('suppresses progress and results from a displaced run', async () => {
    const harness = await setupWorkerHarness();

    solveMock
      .mockImplementationOnce((_levelRuntime, _algorithmId, _options, hooks) => {
        // This test intentionally uses harness-level re-entrancy to exercise displacement guards.
        // Real Worker message delivery is queue-based, so a new SOLVE_START cannot preempt this
        // synchronous solve call mid-stack. True displacement in production would require an
        // async/incremental solver loop (or another yielding strategy) inside the worker.
        harness.emit({
          type: 'SOLVE_START',
          runId: 'run-2',
          protocolVersion: 2,
          levelRuntime: {
            levelId: 'test-level',
            width: 3,
            height: 3,
            staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
            initialPlayerIndex: 4,
            initialBoxes: Uint32Array.from([5]),
          },
          algorithmId: 'bfsPush',
        });
        hooks?.onProgress?.({
          expanded: 3,
          generated: 4,
          depth: 1,
          frontier: 1,
          elapsedMs: 10,
        });
        return {
          status: 'unsolved',
          metrics: {
            elapsedMs: 10,
            expanded: 3,
            generated: 4,
            maxDepth: 1,
            maxFrontier: 1,
            pushCount: 0,
            moveCount: 0,
          },
        };
      })
      .mockImplementationOnce(() => ({
        status: 'solved',
        solutionMoves: 'R',
        metrics: {
          elapsedMs: 2,
          expanded: 1,
          generated: 1,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 1,
          moveCount: 1,
        },
      }));

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-1',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    const run1Progress = harness.messages.find(
      (message) =>
        (message as { type?: string; runId?: string }).type === 'SOLVE_PROGRESS' &&
        (message as { runId?: string }).runId === 'run-1',
    );
    const run1Result = harness.messages.find(
      (message) =>
        (message as { type?: string; runId?: string }).type === 'SOLVE_RESULT' &&
        (message as { runId?: string }).runId === 'run-1',
    );
    const run2Result = harness.messages.find(
      (message) =>
        (message as { type?: string; runId?: string }).type === 'SOLVE_RESULT' &&
        (message as { runId?: string }).runId === 'run-2',
    );

    expect(run1Progress).toBeUndefined();
    expect(run1Result).toBeUndefined();
    expect(run2Result).toMatchObject({ status: 'solved' });
  });

  it('treats SOLVE_CANCEL as an invalid inbound message', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_CANCEL',
      runId: 'run-4',
      protocolVersion: 2,
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'run-4',
      protocolVersion: 2,
      message: 'Invalid inbound protocol message.',
    });
  });

  it('treats BENCH_START as unsupported for solver runtime', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'BENCH_START',
      runId: 'bench-unsupported',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'bench-unsupported',
      protocolVersion: 2,
      message: 'Unsupported inbound message BENCH_START for solver worker.',
    });
  });

  it('uses runId from invalid inbound payloads when available', async () => {
    const harness = await setupWorkerHarness();

    harness.emit({ type: 'SOLVE_START', runId: 'run-5', protocolVersion: 2 });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'run-5',
      protocolVersion: 2,
      message: 'Invalid inbound protocol message.',
    });
  });

  it('passes throttling context to solver and forwards progress callbacks', async () => {
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
      hooks?.onProgress?.({
        expanded: 50,
        generated: 50,
        depth: 0,
        frontier: 0,
        elapsedMs: 50,
      });
      return {
        status: 'unsolved',
        metrics: {
          elapsedMs: 5,
          expanded: 50,
          generated: 50,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 0,
          moveCount: 0,
        },
      };
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-6',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    const progressMessages = harness.messages.filter(
      (message) => (message as { type?: string }).type === 'SOLVE_PROGRESS',
    );
    expect(progressMessages).toHaveLength(3);

    const solveContext = solveMock.mock.calls[0]?.[4] as
      | {
          progressThrottleMs?: number;
          progressExpandedInterval?: number;
        }
      | undefined;
    expect(solveContext?.progressThrottleMs).toBe(100);
    expect(solveContext?.progressExpandedInterval).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('passes through newly added algorithm ids to the solver runtime', async () => {
    solveMock.mockImplementation(() => ({
      status: 'unsolved',
      metrics: {
        elapsedMs: 1,
        expanded: 1,
        generated: 1,
        maxDepth: 0,
        maxFrontier: 1,
        pushCount: 0,
        moveCount: 0,
      },
    }));

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-new-algorithm',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'greedyPush',
      options: { heuristicId: 'assignment' },
    });

    expect(solveMock).toHaveBeenCalledTimes(1);
    expect(solveMock.mock.calls[0]?.[1]).toBe('greedyPush');
    expect(solveMock.mock.calls[0]?.[2]).toEqual({ heuristicId: 'assignment' });
  });

  it('streams progress without best path when spectator stream is disabled', async () => {
    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, hooks) => {
      hooks?.onProgress?.({
        expanded: 2,
        generated: 3,
        depth: 1,
        frontier: 1,
        elapsedMs: 5,
        bestHeuristic: 4,
        bestPathSoFar: 'RR',
      });
      return {
        status: 'solved',
        solutionMoves: 'RR',
        metrics: {
          elapsedMs: 5,
          expanded: 2,
          generated: 3,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 1,
          moveCount: 2,
        },
      };
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-1',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    const progressMessage = harness.messages[0] as {
      bestPathSoFar?: string;
      bestHeuristic?: number;
    };
    expect(progressMessage).toMatchObject({
      type: 'SOLVE_PROGRESS',
      runId: 'run-1',
      bestHeuristic: 4,
    });
    expect(progressMessage.bestPathSoFar).toBeUndefined();
  });

  it('streams best path when spectator stream is enabled', async () => {
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
      type: 'SOLVE_START',
      runId: 'run-2',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
      options: { enableSpectatorStream: true },
    });

    const progressMessage = harness.messages[0] as { bestPathSoFar?: string };
    expect(progressMessage).toMatchObject({
      type: 'SOLVE_PROGRESS',
      runId: 'run-2',
      bestPathSoFar: 'LL',
    });
  });

  it('emits SOLVE_RESULT status error with errorMessage for domain failures', async () => {
    solveMock.mockImplementation(() => ({
      status: 'error',
      errorMessage: 'Domain failure while solving.',
      errorDetails: 'Heuristic configuration mismatch.',
      metrics: {
        elapsedMs: 1,
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
      type: 'SOLVE_START',
      runId: 'run-error',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_RESULT',
      runId: 'run-error',
      protocolVersion: 2,
      status: 'error',
      errorMessage: 'Domain failure while solving.',
      errorDetails: 'Heuristic configuration mismatch.',
    });
    expect(
      harness.messages.some((message) => (message as { type?: string }).type === 'SOLVE_ERROR'),
    ).toBe(false);
  });

  it('emits SOLVE_RESULT error without errorDetails when solver does not provide details', async () => {
    solveMock.mockImplementation(() => ({
      status: 'error',
      errorMessage: 'Domain failure without details.',
      metrics: {
        elapsedMs: 1,
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
      type: 'SOLVE_START',
      runId: 'run-error-nodeets',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    const resultMessage = harness.messages[0] as { errorDetails?: string };
    expect(resultMessage).toMatchObject({
      type: 'SOLVE_RESULT',
      runId: 'run-error-nodeets',
      protocolVersion: 2,
      status: 'error',
      errorMessage: 'Domain failure without details.',
    });
    expect(resultMessage.errorDetails).toBeUndefined();
  });

  it('emits SOLVE_ERROR when solver throws', async () => {
    solveMock.mockImplementation(() => {
      throw new Error('boom');
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-4',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'run-4',
      protocolVersion: 2,
      message: 'Failed to execute solve run.',
      details: 'boom',
    });
  });

  it('emits SOLVE_ERROR with fallback details for non-Error throws', async () => {
    solveMock.mockImplementation(() => {
      throw 'boom';
    });

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-5',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_ERROR',
      runId: 'run-5',
      protocolVersion: 2,
      message: 'Failed to execute solve run.',
      details: 'Unknown solver worker failure.',
    });
  });

  it('uses performance.now when available for solve context', async () => {
    const nowSpy = vi.fn(() => 123);
    vi.stubGlobal('performance', { now: nowSpy });

    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, _hooks, context) => {
      const elapsed = context?.nowMs?.();
      expect(elapsed).toBe(123);
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

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-6',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    expect(nowSpy).toHaveBeenCalled();
    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_RESULT',
      runId: 'run-6',
      protocolVersion: 2,
      status: 'unsolved',
    });
  });

  it('does not inject a non-monotonic clock when performance.now is unavailable', async () => {
    vi.stubGlobal('performance', undefined as never);

    solveMock.mockImplementation((_levelRuntime, _algorithmId, _options, _hooks, context) => {
      expect(context?.nowMs).toBeUndefined();
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

    const harness = await setupWorkerHarness();

    harness.emit({
      type: 'SOLVE_START',
      runId: 'run-7',
      protocolVersion: 2,
      levelRuntime: {
        levelId: 'test-level',
        width: 3,
        height: 3,
        staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
        initialPlayerIndex: 4,
        initialBoxes: Uint32Array.from([5]),
      },
      algorithmId: 'bfsPush',
    });

    expect(harness.messages[0]).toMatchObject({
      type: 'SOLVE_RESULT',
      runId: 'run-7',
      protocolVersion: 2,
      status: 'error',
      errorMessage:
        'Solver clock source unavailable. Pass context.nowMs when performance.now is unavailable.',
    });
  });
});
