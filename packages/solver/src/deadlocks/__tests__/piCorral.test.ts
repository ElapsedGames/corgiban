import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { computeReachability } from '../../infra/reachability';
import { createZobristTable } from '../../infra/zobrist';
import { compileLevel } from '../../state/compiledLevel';
import { createInitialSolverState } from '../../state/solverState';
import { detectPiCorralRestriction } from '../piCorral';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'pi-corral-deadlock-test', name: 'PI Corral Deadlock Test', rows });
}

function buildRestriction(rows: string[]) {
  const level = buildLevel(rows);
  const compiled = compileLevel(level);
  const zobrist = createZobristTable(compiled.cellCount);
  const state = createInitialSolverState(level, compiled, zobrist);
  const reachability = computeReachability(compiled, state.player, state.occupancy);

  return {
    compiled,
    state,
    reachability,
    restriction: detectPiCorralRestriction(compiled, state, reachability),
  };
}

describe('detectPiCorralRestriction', () => {
  it('restricts pushes when every reachable boundary push goes inward', () => {
    const { restriction } = buildRestriction([
      'WWWWWWW',
      'WWWTWWW',
      'WWEBEWW',
      'WPEEEEW',
      'WWWWWWW',
    ]);

    expect(restriction).toBeDefined();
    expect(restriction?.componentSize).toBe(1);
    expect(restriction?.allowedPushKeys.size).toBe(1);
  });

  it('does not restrict when a reachable boundary push can escape outward', () => {
    const { compiled, state, reachability, restriction } = buildRestriction([
      'WWWWWWW',
      'WWWTWWW',
      'WEEBEWW',
      'WPEEEEW',
      'WWWWWWW',
    ]);

    expect(compiled.cellCount - state.boxes.length).toBeGreaterThan(reachability.count);
    expect(restriction).toBeUndefined();
  });

  it('does not restrict when no valid inward boundary push exists', () => {
    const { compiled, state, reachability, restriction } = buildRestriction([
      'WWWWWWW',
      'WWWEWWW',
      'WWWBWWW',
      'WPEEEEW',
      'WWWWWWW',
    ]);

    expect(compiled.cellCount - state.boxes.length).toBeGreaterThan(reachability.count);
    expect(restriction).toBeUndefined();
  });

  it('prefers the larger component when multiple corrals allow the same number of pushes', () => {
    const { restriction } = buildRestriction([
      'WWWWWWWWWWW',
      'WWTWWTEWWWW',
      'WWBWWBWWWWW',
      'WPEEEEEEEEW',
      'WWWWWWWWWWW',
    ]);

    expect(restriction).toBeDefined();
    expect(restriction?.componentSize).toBe(2);
    expect(Array.from(restriction?.allowedPushKeys ?? [])).toEqual([16]);
  });
});
