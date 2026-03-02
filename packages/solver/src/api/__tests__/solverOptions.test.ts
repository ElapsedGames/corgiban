import { describe, expect, it } from 'vitest';

import { normalizeSolverOptions } from '../solverOptions';

describe('normalizeSolverOptions', () => {
  it('defaults heuristic fields for astarPush', () => {
    const result = normalizeSolverOptions('astarPush', undefined);

    expect(result.heuristicId).toBe('manhattan');
    expect(result.heuristicWeight).toBe(1);
    expect(result.enableSpectatorStream).toBe(false);
  });

  it('rejects heuristic fields for bfsPush', () => {
    expect(() =>
      normalizeSolverOptions('bfsPush', {
        heuristicId: 'assignment',
        heuristicWeight: 3,
      }),
    ).toThrow('heuristicId/heuristicWeight');
  });

  it('rejects heuristicId for bfsPush', () => {
    expect(() =>
      normalizeSolverOptions('bfsPush', {
        heuristicId: 'assignment',
      }),
    ).toThrow('heuristicId/heuristicWeight');
  });

  it('rejects heuristicWeight for bfsPush', () => {
    expect(() =>
      normalizeSolverOptions('bfsPush', {
        heuristicWeight: 2,
      }),
    ).toThrow('heuristicId/heuristicWeight');
  });

  it('returns normalized options for bfsPush without heuristics', () => {
    const result = normalizeSolverOptions('bfsPush', {
      timeBudgetMs: 2500,
      nodeBudget: 500,
      enableSpectatorStream: true,
    });

    expect(result).toEqual({
      timeBudgetMs: 2500,
      nodeBudget: 500,
      heuristicId: undefined,
      heuristicWeight: undefined,
      enableSpectatorStream: true,
    });
  });

  it('validates heuristicWeight bounds', () => {
    expect(() => normalizeSolverOptions('astarPush', { heuristicWeight: 0.5 })).toThrow(
      'heuristicWeight',
    );
    expect(() => normalizeSolverOptions('astarPush', { heuristicWeight: 10.5 })).toThrow(
      'heuristicWeight',
    );
  });

  it('validates time and node budgets', () => {
    expect(() => normalizeSolverOptions('astarPush', { timeBudgetMs: 0 })).toThrow('timeBudgetMs');
    expect(() => normalizeSolverOptions('astarPush', { nodeBudget: -1 })).toThrow('nodeBudget');
  });

  it('keeps spectator stream flag when set', () => {
    const result = normalizeSolverOptions('astarPush', { enableSpectatorStream: true });

    expect(result.enableSpectatorStream).toBe(true);
  });
});
