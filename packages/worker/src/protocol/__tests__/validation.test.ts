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

  it('assertOutboundMessage accepts SOLVE_RESULT error payloads', () => {
    const message = assertOutboundMessage({
      type: 'SOLVE_RESULT',
      runId: 'run-5',
      protocolVersion: PROTOCOL_VERSION,
      status: 'error',
      errorMessage: 'Algorithm "astarPush" is not registered in the solver registry.',
      errorDetails: 'Missing registry entry.',
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
    expect(message.errorMessage).toContain('not registered');
  });
});
