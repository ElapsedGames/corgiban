import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyMoves, createGame, isWin, parseLevel } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { normalizeSolverOptions } from '../../api/solverOptions';
import { solve } from '../../api/solve';
import type { SolveResult, SolveSuccessResult } from '../../api/solverTypes';
import { createCancelToken } from '../../infra/cancelToken';
import { createZobristTable } from '../../infra/zobrist';
import { compileLevel } from '../../state/compiledLevel';
import { solveIdaStarPush } from '../idaStarPush';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'ida-level', name: 'IDA* Test Level', rows });
}

function expectSolved(result: SolveResult): asserts result is SolveSuccessResult {
  expect(result.status).toBe('solved');
}

describe('idaStarPush', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('solves a representative level with the default assignment heuristic', () => {
    const level = buildLevel(['WWWWWWW', 'WPEEEEW', 'WEBBTEW', 'WEEETEW', 'WWWWWWW']);

    const result = solve(level, 'idaStarPush', undefined, undefined, { nowMs: () => 0 });

    expectSolved(result);
    expect(result.solutionMoves.length).toBeGreaterThan(0);
    expect(result.metrics.pushCount).toBeGreaterThan(0);

    const replayed = applyMoves(
      createGame(level),
      Array.from(result.solutionMoves) as Direction[],
    ).state;
    expect(isWin(replayed)).toBe(true);
  });

  it('accepts explicit heuristic overrides', () => {
    const level = buildLevel(['WWWWWWW', 'WPEEEEW', 'WEBBTEW', 'WEEETEW', 'WWWWWWW']);

    const result = solve(
      level,
      'idaStarPush',
      { heuristicId: 'manhattan', heuristicWeight: 1 },
      undefined,
      { nowMs: () => 0 },
    );

    expectSolved(result);
    expect(result.metrics.generated).toBeGreaterThan(0);
  });

  it('returns solved immediately when there are no boxes', () => {
    const level = buildLevel(['P']);

    const result = solve(level, 'idaStarPush', undefined, undefined, { nowMs: () => 0 });

    expectSolved(result);
    expect(result.solutionMoves).toBe('');
    expect(result.metrics.pushCount).toBe(0);
    expect(result.metrics.moveCount).toBe(0);
  });

  it('honors a pre-cancelled token', () => {
    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);
    const cancelToken = createCancelToken();
    cancelToken.cancel('stop');

    const result = solve(level, 'idaStarPush', undefined, undefined, {
      nowMs: () => 0,
      cancelToken,
    });

    expect(result.status).toBe('cancelled');
  });

  it('times out when the time budget is exceeded', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WEEEW', 'WWWWW']);
    let current = 0;
    const nowMs = () => {
      current += 5;
      return current;
    };

    const result = solve(level, 'idaStarPush', { timeBudgetMs: 4 }, undefined, { nowMs });

    expect(result.status).toBe('timeout');
  });

  it('respects node budget timeouts', () => {
    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);

    const result = solve(level, 'idaStarPush', { nodeBudget: 1 }, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('timeout');
    expect(result.metrics.expanded).toBeGreaterThanOrEqual(1);
  });

  it('returns unsolved when no pushes are available', () => {
    const level = buildLevel(['WWWWWWW', 'WPWEEEW', 'WWWEEEW', 'WEEBTEW', 'WWWWWWW']);

    const result = solve(level, 'idaStarPush', undefined, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.pushCount).toBe(0);
  });

  it('returns an explicit error for direct callers when no monotonic clock is available', () => {
    vi.stubGlobal('performance', undefined);

    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);
    const compiled = compileLevel(level);

    const result = solveIdaStarPush({
      level,
      compiled,
      zobrist: createZobristTable(compiled.cellCount),
      options: normalizeSolverOptions('idaStarPush', undefined),
      context: {},
    });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorMessage).toContain('clock source unavailable');
      expect(result.metrics.elapsedMs).toBe(0);
    }
  });
});
