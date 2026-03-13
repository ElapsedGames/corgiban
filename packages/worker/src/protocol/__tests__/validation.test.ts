import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION } from '../protocol';
import {
  assertInboundMessage,
  assertOutboundMessage,
  ProtocolValidationError,
  validateInboundMessage,
  validateOutboundMessage,
} from '../validation';

const sampleLevelRuntime = {
  levelId: 'test-level',
  width: 3,
  height: 3,
  staticGrid: Uint8Array.from([0, 0, 0, 0, 1, 0, 0, 0, 0]),
  initialPlayerIndex: 4,
  initialBoxes: Uint32Array.from([5]),
};

describe('protocol validation helpers', () => {
  it('accepts valid inbound SOLVE_START messages', () => {
    const result = validateInboundMessage({
      type: 'SOLVE_START',
      runId: 'run-1',
      protocolVersion: PROTOCOL_VERSION,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: {
        timeBudgetMs: 1000,
        nodeBudget: 100,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.message.type).toBe('SOLVE_START');
  });

  it('accepts new algorithm ids through validation helpers', () => {
    const solveResult = validateInboundMessage({
      type: 'SOLVE_START',
      runId: 'run-new',
      protocolVersion: PROTOCOL_VERSION,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'tunnelMacroPush',
      options: {
        heuristicId: 'assignment',
        heuristicWeight: 1,
      },
    });

    expect(solveResult.ok).toBe(true);

    const benchResult = validateInboundMessage({
      type: 'BENCH_START',
      runId: 'bench-new',
      benchmarkCaseId: 'case-new',
      protocolVersion: PROTOCOL_VERSION,
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'piCorralPush',
      options: {
        heuristicId: 'assignment',
        heuristicWeight: 1,
      },
    });

    expect(benchResult.ok).toBe(true);
  });

  it('accepts valid inbound BENCH_START messages', () => {
    const result = validateInboundMessage({
      type: 'BENCH_START',
      runId: 'bench-1',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-1',
      levelRuntime: sampleLevelRuntime,
      algorithmId: 'bfsPush',
      options: {
        timeBudgetMs: 1000,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.message.type).toBe('BENCH_START');
  });

  it('rejects inbound messages with invalid protocolVersion', () => {
    const result = validateInboundMessage({
      type: 'PING',
      protocolVersion: PROTOCOL_VERSION + 1,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBeInstanceOf(ProtocolValidationError);
    expect(result.error.direction).toBe('inbound');
  });

  it('rejects outbound messages with unknown message types', () => {
    const result = validateOutboundMessage({
      type: 'UNKNOWN',
      runId: 'run-3',
      protocolVersion: PROTOCOL_VERSION,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.direction).toBe('outbound');
  });

  it('supports light SOLVE_PROGRESS validation mode for high-frequency messages', () => {
    const result = validateOutboundMessage(
      {
        type: 'SOLVE_PROGRESS',
        runId: 'run-fast',
        protocolVersion: PROTOCOL_VERSION,
        expanded: 1,
        generated: 1,
        depth: 0,
        frontier: 0,
        elapsedMs: 1,
        extra: 'not-validated-in-light-mode',
      },
      { mode: 'light-progress' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.message.type).toBe('SOLVE_PROGRESS');
  });

  it('keeps structural message validation strict in light mode', () => {
    const result = validateOutboundMessage(
      {
        type: 'BENCH_RESULT',
        runId: 'bench-light',
        protocolVersion: PROTOCOL_VERSION,
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
        unknownField: true,
      },
      { mode: 'light-progress' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.direction).toBe('outbound');
  });

  it('assertInboundMessage throws on invalid payload', () => {
    expect(() =>
      assertInboundMessage({
        type: 'SOLVE_START',
        runId: '',
        protocolVersion: PROTOCOL_VERSION,
        levelRuntime: sampleLevelRuntime,
        algorithmId: 'bfsPush',
      }),
    ).toThrow(ProtocolValidationError);
  });

  it('assertOutboundMessage returns valid typed payload', () => {
    const message = assertOutboundMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-4',
      protocolVersion: PROTOCOL_VERSION,
      status: 'solved',
      solutionMoves: 'RR',
      metrics: {
        elapsedMs: 10,
        expanded: 3,
        generated: 4,
        maxDepth: 2,
        maxFrontier: 2,
        pushCount: 1,
        moveCount: 2,
      },
    });

    expect(message.type).toBe('SOLVE_RESULT');
  });

  it('assertOutboundMessage returns valid BENCH_RESULT payload', () => {
    const message = assertOutboundMessage({
      type: 'BENCH_RESULT',
      runId: 'bench-2',
      protocolVersion: PROTOCOL_VERSION,
      benchmarkCaseId: 'case-2',
      status: 'solved',
      solutionMoves: 'RR',
      metrics: {
        elapsedMs: 10,
        expanded: 3,
        generated: 4,
        maxDepth: 2,
        maxFrontier: 2,
        pushCount: 1,
        moveCount: 2,
      },
    });

    expect(message.type).toBe('BENCH_RESULT');
  });

  it('assertOutboundMessage accepts SOLVE_RESULT error payloads', () => {
    const message = assertOutboundMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-5',
      protocolVersion: PROTOCOL_VERSION,
      status: 'error',
      errorMessage: 'Domain failure while solving.',
      errorDetails: 'Heuristic configuration mismatch.',
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

    expect(message.type).toBe('SOLVE_RESULT');
    if (message.type !== 'SOLVE_RESULT') {
      return;
    }
    expect(message.status).toBe('error');
    if (message.status !== 'error') {
      return;
    }
    expect(message.errorMessage).toContain('Domain failure');
  });

  it('rejects outbound BENCH_RESULT status error payloads without errorMessage', () => {
    expect(() =>
      assertOutboundMessage({
        type: 'BENCH_RESULT',
        runId: 'bench-3',
        protocolVersion: PROTOCOL_VERSION,
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
      }),
    ).toThrow(ProtocolValidationError);
  });

  it('rejects malformed SOLVE_PROGRESS fields even in light validation mode', () => {
    const baseMessage = {
      type: 'SOLVE_PROGRESS',
      runId: 'run-light',
      protocolVersion: PROTOCOL_VERSION,
      expanded: 1,
      generated: 1,
      depth: 0,
      frontier: 0,
      elapsedMs: 1,
    } as const;

    const invalidPayloads: unknown[] = [
      { ...baseMessage, runId: '' },
      { ...baseMessage, protocolVersion: PROTOCOL_VERSION + 1 },
      { ...baseMessage, expanded: -1 },
      { ...baseMessage, generated: 1.5 },
      { ...baseMessage, depth: -1 },
      { ...baseMessage, frontier: -1 },
      { ...baseMessage, elapsedMs: -1 },
      { ...baseMessage, bestHeuristic: 'not-a-number' },
      { ...baseMessage, bestPathSoFar: 42 },
    ];

    invalidPayloads.forEach((payload) => {
      const result = validateOutboundMessage(payload, { mode: 'light-progress' });
      expect(result.ok).toBe(false);
      if (result.ok) {
        return;
      }
      expect(result.error.direction).toBe('outbound');
    });
  });

  it('assertOutboundMessage includes structured issues on failure', () => {
    try {
      assertOutboundMessage({
        protocolVersion: PROTOCOL_VERSION,
      });
      throw new Error('Expected assertOutboundMessage to throw.');
    } catch (error) {
      expect(error).toBeInstanceOf(ProtocolValidationError);
      const protocolError = error as ProtocolValidationError;
      expect(protocolError.direction).toBe('outbound');
      expect(protocolError.issues.length).toBeGreaterThan(0);
      expect(protocolError.payload).toEqual({ protocolVersion: PROTOCOL_VERSION });
    }
  });
});
