import { afterEach, describe, expect, it, vi } from 'vitest';

import { solve } from '../solve';
import type { AlgorithmId, SolveResult } from '../solverTypes';
import * as registry from '../registry';

function expectErrorResult(result: SolveResult): Extract<SolveResult, { status: 'error' }> {
  expect(result.status).toBe('error');
  return result as Extract<SolveResult, { status: 'error' }>;
}

describe('solve', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns solved status for a zero-box level', () => {
    // A level with no boxes is trivially won: bfsPush should return solved immediately
    const result = solve(
      {
        levelId: 'trivial',
        width: 3,
        height: 1,
        staticGrid: Uint8Array.from([0, 1, 0]),
        initialPlayerIndex: 1,
        initialBoxes: Uint32Array.from([]),
      },
      'bfsPush',
      undefined,
      undefined,
      { nowMs: () => 0 },
    );

    expect(result.status).toBe('solved');
  });

  it('returns error status when algorithm is missing', () => {
    const result = solve(
      {
        levelId: 'level',
        width: 1,
        height: 1,
        staticGrid: Uint8Array.from([1]),
        initialPlayerIndex: 0,
        initialBoxes: Uint32Array.from([]),
      },
      'unknown' as AlgorithmId,
      undefined,
      undefined,
      { nowMs: () => 0 },
    );

    const errorResult = expectErrorResult(result);

    expect(errorResult.metrics.expanded).toBe(0);
    expect(errorResult.metrics.generated).toBe(0);
    expect(errorResult.errorMessage).toContain('not registered');
  });

  it('captures algorithm exceptions as error results', () => {
    const fallback: SolveResult = {
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
      errorMessage: 'Solver run failed for algorithm "bfsPush".',
      errorDetails: 'boom',
    };

    const spy = vi.spyOn(registry, 'getAlgorithm').mockReturnValue({
      id: 'bfsPush',
      solve: () => {
        throw new Error('boom');
      },
    });

    const result = solve(
      {
        levelId: 'level',
        width: 1,
        height: 1,
        staticGrid: Uint8Array.from([1]),
        initialPlayerIndex: 0,
        initialBoxes: Uint32Array.from([]),
      },
      'bfsPush',
      undefined,
      undefined,
      { nowMs: () => 0 },
    );

    spy.mockRestore();

    expect(result).toEqual(fallback);
  });

  it('uses performance.now as the default nowMs when no context clock is provided', () => {
    const nowMock = vi.fn(() => 12);
    vi.stubGlobal('performance', {
      now: nowMock,
    });

    const result = solve(
      {
        levelId: 'missing-algorithm-default-now',
        width: 1,
        height: 1,
        staticGrid: Uint8Array.from([1]),
        initialPlayerIndex: 0,
        initialBoxes: Uint32Array.from([]),
      },
      'unknown' as AlgorithmId,
    );

    expectErrorResult(result);
    expect(nowMock).toHaveBeenCalled();
  });

  it('returns an explicit error when no default clock source is available', () => {
    vi.stubGlobal('performance', undefined);

    const result = solve(
      {
        levelId: 'missing-algorithm-no-perf',
        width: 1,
        height: 1,
        staticGrid: Uint8Array.from([1]),
        initialPlayerIndex: 0,
        initialBoxes: Uint32Array.from([]),
      },
      'unknown' as AlgorithmId,
    );

    const errorResult = expectErrorResult(result);

    expect(errorResult.errorMessage).toContain('clock source unavailable');
    expect(errorResult.metrics.elapsedMs).toBe(0);
  });

  it('captures string exceptions as errorDetails', () => {
    const spy = vi.spyOn(registry, 'getAlgorithm').mockReturnValue({
      id: 'bfsPush',
      solve: () => {
        throw 'string boom';
      },
    });

    const result = solve(
      {
        levelId: 'level',
        width: 1,
        height: 1,
        staticGrid: Uint8Array.from([1]),
        initialPlayerIndex: 0,
        initialBoxes: Uint32Array.from([]),
      },
      'bfsPush',
      undefined,
      undefined,
      { nowMs: () => 0 },
    );

    spy.mockRestore();

    const errorResult = expectErrorResult(result);

    expect(errorResult.errorDetails).toBe('string boom');
  });

  it('omits errorDetails when algorithm throws a non-Error object', () => {
    const spy = vi.spyOn(registry, 'getAlgorithm').mockReturnValue({
      id: 'bfsPush',
      solve: () => {
        throw { code: 'E_OBJECT' };
      },
    });

    const result = solve(
      {
        levelId: 'level',
        width: 1,
        height: 1,
        staticGrid: Uint8Array.from([1]),
        initialPlayerIndex: 0,
        initialBoxes: Uint32Array.from([]),
      },
      'bfsPush',
      undefined,
      undefined,
      { nowMs: () => 0 },
    );

    spy.mockRestore();

    const errorResult = expectErrorResult(result);

    expect(errorResult.errorDetails).toBeUndefined();
  });
});
