import { describe, expect, it } from 'vitest';

import {
  parseWorkerInboundMessage,
  parseWorkerOutboundMessage,
  solverSchemas,
  workerInboundSchema,
  workerOutboundSchema,
} from '../schema';
import { PROTOCOL_VERSION } from '../protocol';

const sampleLevelRuntime = {
  levelId: 'test-level',
  width: 3,
  height: 3,
  staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
  initialPlayerIndex: 4,
  initialBoxes: Uint32Array.from([5]),
};

function buildSolveStart(levelRuntime = sampleLevelRuntime) {
  return {
    type: 'SOLVE_START' as const,
    runId: 'run-base',
    protocolVersion: PROTOCOL_VERSION,
    levelRuntime,
    algorithmId: 'bfsPush' as const,
  };
}

describe('solverSchemas', () => {
  it('accepts SOLVE_PROGRESS with bestPathSoFar', () => {
    const result = solverSchemas.solveProgressSchema.safeParse({
      type: 'SOLVE_PROGRESS',
      runId: 'run-1',
      protocolVersion: PROTOCOL_VERSION,
      expanded: 10,
      generated: 12,
      depth: 4,
      frontier: 5,
      elapsedMs: 25,
      bestHeuristic: 3,
      bestPathSoFar: 'URDL',
    });

    expect(result.success).toBe(true);
  });

  it('rejects SOLVE_RESULT without new metrics fields', () => {
    const result = solverSchemas.solveResultSchema.safeParse({
      type: 'SOLVE_RESULT',
      runId: 'run-2',
      protocolVersion: PROTOCOL_VERSION,
      status: 'solved',
      solutionMoves: 'URDL',
      metrics: {
        elapsedMs: 25,
        expanded: 10,
        generated: 12,
        maxDepth: 4,
        maxFrontier: 5,
        moveCount: 12,
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts SOLVE_START with solver options', () => {
    const result = solverSchemas.solveStartSchema.safeParse({
      type: 'SOLVE_START',
      runId: 'run-3',
      protocolVersion: PROTOCOL_VERSION,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'astarPush',
      options: {
        timeBudgetMs: 1000,
        nodeBudget: 100,
        heuristicId: 'manhattan',
        heuristicWeight: 2,
        enableSpectatorStream: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts newly added algorithm ids in solve and bench messages', () => {
    expect(
      solverSchemas.solveStartSchema.safeParse({
        type: 'SOLVE_START',
        runId: 'run-new-solver',
        protocolVersion: PROTOCOL_VERSION,
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'piCorralPush',
        options: {
          heuristicId: 'assignment',
          heuristicWeight: 1,
        },
      }).success,
    ).toBe(true);

    expect(
      solverSchemas.benchStartSchema.safeParse({
        type: 'BENCH_START',
        runId: 'run-new-bench',
        benchmarkCaseId: 'case-new-bench',
        protocolVersion: PROTOCOL_VERSION,
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'greedyPush',
        options: {
          heuristicId: 'manhattan',
        },
      }).success,
    ).toBe(true);
  });

  it('accepts SOLVE_START when options are omitted', () => {
    const result = solverSchemas.solveStartSchema.safeParse({
      type: 'SOLVE_START',
      runId: 'run-3b',
      protocolVersion: PROTOCOL_VERSION,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(result.success).toBe(true);
  });

  it('rejects SOLVE_START with invalid options values', () => {
    const result = solverSchemas.solveStartSchema.safeParse({
      type: 'SOLVE_START',
      runId: 'run-3c',
      protocolVersion: PROTOCOL_VERSION,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'astarPush',
      options: {
        timeBudgetMs: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts BENCH_START with benchmarkCaseId', () => {
    const result = solverSchemas.benchStartSchema.safeParse({
      type: 'BENCH_START',
      runId: 'run-bench-1',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-1',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'astarPush',
      options: {
        timeBudgetMs: 1000,
        nodeBudget: 100,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts BENCH_START when options are omitted', () => {
    const result = solverSchemas.benchStartSchema.safeParse({
      type: 'BENCH_START',
      runId: 'run-bench-1b',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-1b',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(result.success).toBe(true);
  });

  it('rejects BENCH_START when options are not an object', () => {
    const result = solverSchemas.benchStartSchema.safeParse({
      type: 'BENCH_START',
      runId: 'run-bench-1c',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-1c',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: 'invalid-options',
    });

    expect(result.success).toBe(false);
  });

  it('rejects BENCH_START with unknown options keys', () => {
    const result = solverSchemas.benchStartSchema.safeParse({
      type: 'BENCH_START',
      runId: 'run-bench-1d',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-1d',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: {
        timeBudgetMs: 1000,
        unknownField: true,
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects BENCH_START with an empty benchmarkCaseId', () => {
    const result = solverSchemas.benchStartSchema.safeParse({
      type: 'BENCH_START',
      runId: 'run-bench-2',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: '',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
    });

    expect(result.success).toBe(false);
  });

  it('rejects SOLVE_START when staticGrid length does not match width * height', () => {
    const result = solverSchemas.solveStartSchema.safeParse(
      buildSolveStart({
        ...sampleLevelRuntime,
        staticGrid: Uint8Array.from([0, 1, 0]),
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects SOLVE_START when initialPlayerIndex is out of bounds', () => {
    const result = solverSchemas.solveStartSchema.safeParse(
      buildSolveStart({
        ...sampleLevelRuntime,
        initialPlayerIndex: 9,
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects SOLVE_START when an initial box index is out of bounds', () => {
    const result = solverSchemas.solveStartSchema.safeParse(
      buildSolveStart({
        ...sampleLevelRuntime,
        initialBoxes: Uint32Array.from([8, 9]),
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects SOLVE_START when initialBoxes contains duplicates', () => {
    const result = solverSchemas.solveStartSchema.safeParse(
      buildSolveStart({
        ...sampleLevelRuntime,
        initialBoxes: Uint32Array.from([5, 5]),
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects SOLVE_START when player starts on a box cell', () => {
    const result = solverSchemas.solveStartSchema.safeParse(
      buildSolveStart({
        ...sampleLevelRuntime,
        initialPlayerIndex: 5,
        initialBoxes: Uint32Array.from([5, 6]),
      }),
    );

    expect(result.success).toBe(false);
  });

  it('accepts a valid SOLVE_RESULT with all required metrics fields', () => {
    const result = solverSchemas.solveResultSchema.safeParse({
      type: 'SOLVE_RESULT',
      runId: 'run-4',
      protocolVersion: PROTOCOL_VERSION,
      status: 'solved',
      solutionMoves: 'URDL',
      metrics: {
        elapsedMs: 25,
        expanded: 10,
        generated: 12,
        maxDepth: 4,
        maxFrontier: 5,
        pushCount: 3,
        moveCount: 12,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts SOLVE_RESULT status error with errorMessage', () => {
    const result = solverSchemas.solveResultSchema.safeParse({
      type: 'SOLVE_RESULT',
      runId: 'run-5',
      protocolVersion: PROTOCOL_VERSION,
      status: 'error',
      errorMessage: 'Domain failure while solving.',
      errorDetails: 'Heuristic configuration mismatch.',
      metrics: {
        elapsedMs: 25,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts BENCH_PROGRESS with benchmarkCaseId', () => {
    const result = solverSchemas.benchProgressSchema.safeParse({
      type: 'BENCH_PROGRESS',
      runId: 'run-bench-3',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-3',
      expanded: 10,
      generated: 12,
      depth: 4,
      frontier: 5,
      elapsedMs: 25,
      bestHeuristic: 3,
      bestPathSoFar: 'URDL',
    });

    expect(result.success).toBe(true);
  });

  it('accepts BENCH_RESULT status error with errorMessage', () => {
    const result = solverSchemas.benchResultSchema.safeParse({
      type: 'BENCH_RESULT',
      runId: 'run-bench-4',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-4',
      status: 'error',
      errorMessage: 'Benchmark solve failed.',
      errorDetails: 'Missing algorithm config.',
      metrics: {
        elapsedMs: 25,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects SOLVE_RESULT status error without errorMessage', () => {
    const result = solverSchemas.solveResultSchema.safeParse({
      type: 'SOLVE_RESULT',
      runId: 'run-5b',
      protocolVersion: PROTOCOL_VERSION,
      status: 'error',
      metrics: {
        elapsedMs: 25,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts a valid SOLVE_ERROR message', () => {
    const result = solverSchemas.solveErrorSchema.safeParse({
      type: 'SOLVE_ERROR',
      runId: 'run-6',
      protocolVersion: PROTOCOL_VERSION,
      message: 'something went wrong',
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid PING message', () => {
    const result = solverSchemas.pingSchema.safeParse({
      type: 'PING',
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(result.success).toBe(true);
  });

  it('accepts a valid PONG message', () => {
    const result = solverSchemas.pongSchema.safeParse({
      type: 'PONG',
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(result.success).toBe(true);
  });

  it('accepts valid inbound union messages (SOLVE_START)', () => {
    expect(
      workerInboundSchema.safeParse({
        type: 'SOLVE_START',
        runId: 'run-7',
        protocolVersion: PROTOCOL_VERSION,
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      }).success,
    ).toBe(true);
  });

  it('accepts valid inbound union messages (BENCH_START)', () => {
    expect(
      workerInboundSchema.safeParse({
        type: 'BENCH_START',
        runId: 'run-8',
        protocolVersion: PROTOCOL_VERSION,
        benchmarkCaseId: 'case-8',
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      }).success,
    ).toBe(true);
  });

  it('parses inbound PING payloads through parseWorkerInboundMessage', () => {
    const result = parseWorkerInboundMessage({
      type: 'PING',
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.type).toBe('PING');
  });

  it('rejects inbound payloads whose width and height overflow safe cell counts', () => {
    const result = parseWorkerInboundMessage(
      buildSolveStart({
        ...sampleLevelRuntime,
        width: Number.MAX_SAFE_INTEGER,
        height: 2,
        staticGrid: Uint8Array.from([0]),
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'levelRuntime.width')).toBe(
      true,
    );
  });

  it('reports duplicate box issues through parseWorkerInboundMessage', () => {
    const result = parseWorkerInboundMessage(
      buildSolveStart({
        ...sampleLevelRuntime,
        initialBoxes: Uint32Array.from([5, 5]),
      }),
    );

    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(
      result.error.issues.some((issue) => issue.path.join('.') === 'levelRuntime.initialBoxes.1'),
    ).toBe(true);
  });

  it('accepts valid outbound union messages (PONG)', () => {
    expect(
      workerOutboundSchema.safeParse({
        type: 'PONG',
        protocolVersion: PROTOCOL_VERSION,
      }).success,
    ).toBe(true);
  });

  it('accepts valid outbound union messages (BENCH_PROGRESS)', () => {
    expect(
      workerOutboundSchema.safeParse({
        type: 'BENCH_PROGRESS',
        runId: 'run-9',
        protocolVersion: PROTOCOL_VERSION,
        benchmarkCaseId: 'case-9',
        expanded: 1,
        generated: 1,
        depth: 0,
        frontier: 0,
        elapsedMs: 1,
      }).success,
    ).toBe(true);
  });

  it('accepts valid outbound union messages (BENCH_RESULT)', () => {
    expect(
      workerOutboundSchema.safeParse({
        type: 'BENCH_RESULT',
        runId: 'run-10',
        protocolVersion: PROTOCOL_VERSION,
        benchmarkCaseId: 'case-10',
        status: 'solved',
        solutionMoves: 'R',
        metrics: {
          elapsedMs: 1,
          expanded: 1,
          generated: 1,
          maxDepth: 1,
          maxFrontier: 1,
          pushCount: 1,
          moveCount: 1,
        },
      }).success,
    ).toBe(true);
  });

  it('parses outbound BENCH_RESULT error payloads through parseWorkerOutboundMessage', () => {
    const result = parseWorkerOutboundMessage({
      type: 'BENCH_RESULT',
      runId: 'run-bench-error',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-error',
      status: 'error',
      errorMessage: 'Benchmark failed.',
      metrics: {
        elapsedMs: 0,
        expanded: 0,
        generated: 0,
        maxDepth: 0,
        maxFrontier: 0,
        pushCount: 0,
        moveCount: 0,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.type).toBe('BENCH_RESULT');
  });

  it('rejects outbound BENCH_PROGRESS payloads with empty benchmarkCaseId', () => {
    const result = parseWorkerOutboundMessage({
      type: 'BENCH_PROGRESS',
      runId: 'run-bad-progress',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: '',
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 1,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown inbound message types', () => {
    const result = workerInboundSchema.safeParse({
      type: 'UNKNOWN',
      runId: 'run-1',
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown outbound message types', () => {
    const result = workerOutboundSchema.safeParse({
      type: 'UNKNOWN',
      runId: 'run-1',
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(result.success).toBe(false);
  });
});
