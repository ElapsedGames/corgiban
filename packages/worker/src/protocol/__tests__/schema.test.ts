import { describe, expect, it } from 'vitest';

import { solverSchemas, workerInboundSchema, workerOutboundSchema } from '../schema';
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
      errorMessage: 'Algorithm "astarPush" is not registered in the solver registry.',
      errorDetails: 'Missing registry entry.',
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

  it('accepts valid outbound union messages (PONG)', () => {
    expect(
      workerOutboundSchema.safeParse({
        type: 'PONG',
        protocolVersion: PROTOCOL_VERSION,
      }).success,
    ).toBe(true);
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
