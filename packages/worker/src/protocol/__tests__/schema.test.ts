import { describe, expect, it } from 'vitest';

import { solverSchemas, workerInboundSchema, workerOutboundSchema } from '../schema';

const sampleLevelRuntime = {
  levelId: 'test-level',
  width: 3,
  height: 3,
  staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
  initialPlayerIndex: 4,
  initialBoxes: Uint32Array.from([5]),
};

describe('solverSchemas', () => {
  it('accepts SOLVE_PROGRESS with bestPathSoFar', () => {
    const result = solverSchemas.solveProgressSchema.safeParse({
      type: 'SOLVE_PROGRESS',
      runId: 'run-1',
      protocolVersion: 1,
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
      protocolVersion: 1,
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
      protocolVersion: 1,
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

  it('rejects unknown inbound message types', () => {
    const result = workerInboundSchema.safeParse({
      type: 'UNKNOWN',
      runId: 'run-1',
      protocolVersion: 1,
    });

    expect(result.success).toBe(false);
  });

  it('rejects unknown outbound message types', () => {
    const result = workerOutboundSchema.safeParse({
      type: 'UNKNOWN',
      runId: 'run-1',
      protocolVersion: 1,
    });

    expect(result.success).toBe(false);
  });
});
