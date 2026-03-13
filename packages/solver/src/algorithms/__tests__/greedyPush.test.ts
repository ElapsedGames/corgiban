import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyMoves, createGame, isWin, parseLevel } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { solve } from '../../api/solve';
import type { SolveResult, SolveSuccessResult } from '../../api/solverTypes';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'greedy-level', name: 'Greedy Test Level', rows });
}

function expectSolved(result: SolveResult): asserts result is SolveSuccessResult {
  expect(result.status).toBe('solved');
}

describe('greedyPush', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('solves a representative level with the default assignment heuristic', () => {
    const level = buildLevel(['WWWWWWW', 'WPEEEEW', 'WEBBTEW', 'WEEETEW', 'WWWWWWW']);

    const result = solve(level, 'greedyPush', undefined, undefined, { nowMs: () => 0 });

    expectSolved(result);
    expect(result.solutionMoves.length).toBeGreaterThan(0);
    expect(result.metrics.pushCount).toBeGreaterThan(0);

    const replayed = applyMoves(
      createGame(level),
      Array.from(result.solutionMoves) as Direction[],
    ).state;
    expect(isWin(replayed)).toBe(true);
  });

  it('allows explicit heuristic overrides', () => {
    const level = buildLevel(['WWWWWWW', 'WPEEEEW', 'WEBBTEW', 'WEEETEW', 'WWWWWWW']);

    const result = solve(level, 'greedyPush', { heuristicId: 'manhattan' }, undefined, {
      nowMs: () => 0,
    });

    expectSolved(result);
    expect(result.metrics.generated).toBeGreaterThan(0);
  });
});
