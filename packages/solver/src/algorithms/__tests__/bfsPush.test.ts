import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { solve } from '../../api/solve';
import { createCancelToken } from '../../infra/cancelToken';
import type { CancelToken } from '../../infra/cancelToken';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('bfsPush', () => {
  it('solves a simple push level', () => {
    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);

    const result = solve(level, 'bfsPush', undefined, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('solved');
    if (result.status !== 'solved') {
      return;
    }
    expect(result.solutionMoves).toBe('R');
    expect(result.metrics.pushCount).toBe(1);
    expect(result.metrics.moveCount).toBe(1);
    expect(result.metrics.expanded).toBeGreaterThanOrEqual(1);
  });

  it('returns solved immediately when there are no boxes', () => {
    const level = buildLevel(['P']);

    const result = solve(level, 'bfsPush', undefined, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('solved');
    if (result.status !== 'solved') {
      return;
    }
    expect(result.solutionMoves).toBe('');
    expect(result.metrics.pushCount).toBe(0);
    expect(result.metrics.moveCount).toBe(0);
  });

  it('honors a pre-cancelled token', () => {
    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);
    const cancelToken = createCancelToken();
    cancelToken.cancel('stop');

    const result = solve(level, 'bfsPush', undefined, undefined, {
      nowMs: () => 0,
      cancelToken,
    });

    expect(result.status).toBe('cancelled');
  });

  it('cancels after work has begun when the token flips mid-run', () => {
    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);
    let checks = 0;
    const cancelToken = {
      cancel: () => undefined,
      getReason: () => undefined,
      isCancelled: () => {
        checks += 1;
        return checks > 1;
      },
    } as CancelToken;

    const result = solve(level, 'bfsPush', undefined, undefined, {
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

    const result = solve(level, 'bfsPush', { timeBudgetMs: 4 }, undefined, { nowMs });

    expect(result.status).toBe('timeout');
  });

  it('throttles progress reporting', () => {
    const level = buildLevel(['WWWWWWW', 'WPEEEEW', 'WEBBTEW', 'WEEETEW', 'WWWWWWW']);
    const progress: number[] = [];
    let current = 0;
    const nowMs = () => {
      current += 10;
      return current;
    };

    const result = solve(
      level,
      'bfsPush',
      { nodeBudget: 5 },
      {
        onProgress: (snapshot) => {
          progress.push(snapshot.expanded);
        },
      },
      {
        nowMs,
        progressThrottleMs: 1000,
        progressExpandedInterval: 100,
      },
    );

    expect(result.status).toBe('timeout');
    expect(result.metrics.expanded).toBeGreaterThan(1);
    expect(progress.length).toBe(1);
  });

  it('respects node budget timeouts', () => {
    const level = buildLevel(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']);

    const result = solve(level, 'bfsPush', { nodeBudget: 1 }, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('timeout');
    expect(result.metrics.expanded).toBeGreaterThanOrEqual(1);
  });

  it('skips pushes when the player cannot reach the push-from cell', () => {
    const level = buildLevel(['WWWWWWW', 'WPWEEEW', 'WWWEEEW', 'WEEBTEW', 'WWWWWWW']);

    const result = solve(level, 'bfsPush', undefined, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.pushCount).toBe(0);
  });

  it('skips pushes that would move a box into another box', () => {
    const level = buildLevel(['WWWWW', 'WPBBW', 'WTEEW', 'WWWWW']);

    const result = solve(level, 'bfsPush', undefined, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.pushCount).toBe(0);
  });

  it('does not push boxes into dead squares', () => {
    const level = buildLevel(['WWWWW', 'WPBEW', 'WEEEW', 'WWTWW', 'WWWWW']);

    const result = solve(level, 'bfsPush', { nodeBudget: 10 }, undefined, { nowMs: () => 0 });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.pushCount).toBe(0);
  });
});
