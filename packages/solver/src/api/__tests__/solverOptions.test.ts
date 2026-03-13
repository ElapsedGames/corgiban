import { describe, expect, it } from 'vitest';

import { normalizeSolverOptions } from '../solverOptions';

describe('normalizeSolverOptions', () => {
  it('defaults heuristic fields for astarPush', () => {
    const result = normalizeSolverOptions('astarPush', undefined);

    expect(result.heuristicId).toBe('manhattan');
    expect(result.heuristicWeight).toBe(1);
    expect(result.enableSpectatorStream).toBe(false);
  });

  it('defaults idaStarPush to the assignment heuristic', () => {
    const result = normalizeSolverOptions('idaStarPush', undefined);

    expect(result.heuristicId).toBe('assignment');
    expect(result.heuristicWeight).toBe(1);
    expect(result.enableSpectatorStream).toBe(false);
  });

  it('defaults greedyPush to assignment and rejects heuristicWeight', () => {
    const result = normalizeSolverOptions('greedyPush', undefined);

    expect(result.heuristicId).toBe('assignment');
    expect(result.heuristicWeight).toBeUndefined();
    expect(result.enableSpectatorStream).toBe(false);
    expect(() => normalizeSolverOptions('greedyPush', { heuristicWeight: 2 })).toThrow(
      'heuristicWeight',
    );
  });

  it('defaults tunnelMacroPush and piCorralPush to the assignment heuristic', () => {
    const tunnelResult = normalizeSolverOptions('tunnelMacroPush', undefined);
    const corralResult = normalizeSolverOptions('piCorralPush', undefined);

    expect(tunnelResult.heuristicId).toBe('assignment');
    expect(tunnelResult.heuristicWeight).toBe(1);
    expect(corralResult.heuristicId).toBe('assignment');
    expect(corralResult.heuristicWeight).toBe(1);
  });

  it('rejects heuristic fields for bfsPush', () => {
    expect(() =>
      normalizeSolverOptions('bfsPush', {
        heuristicId: 'assignment',
        heuristicWeight: 3,
      }),
    ).toThrow('heuristicId/heuristicWeight');
  });

  it('rejects heuristicWeight alone for bfsPush', () => {
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

  it('accepts heuristicWeight at the exact valid boundaries', () => {
    expect(() => normalizeSolverOptions('astarPush', { heuristicWeight: 1 })).not.toThrow();
    expect(() => normalizeSolverOptions('astarPush', { heuristicWeight: 10 })).not.toThrow();
  });

  it('normalizes idaStarPush with explicit assignment heuristic options', () => {
    const result = normalizeSolverOptions('idaStarPush', {
      heuristicId: 'assignment',
      heuristicWeight: 2.5,
      timeBudgetMs: 1000,
      nodeBudget: 2000,
      enableSpectatorStream: true,
    });

    expect(result).toEqual({
      heuristicId: 'assignment',
      heuristicWeight: 2.5,
      timeBudgetMs: 1000,
      nodeBudget: 2000,
      enableSpectatorStream: true,
    });
  });

  it('applies default heuristic weight for idaStarPush when only heuristicId is provided', () => {
    const result = normalizeSolverOptions('idaStarPush', { heuristicId: 'assignment' });

    expect(result.heuristicId).toBe('assignment');
    expect(result.heuristicWeight).toBe(1);
    expect(result.enableSpectatorStream).toBe(false);
  });
});
