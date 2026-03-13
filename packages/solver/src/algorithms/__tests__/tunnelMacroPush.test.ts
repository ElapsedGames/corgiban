import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { solve } from '../../api/solve';
import { createZobristTable } from '../../infra/zobrist';
import { compileLevel } from '../../state/compiledLevel';
import { createInitialSolverState } from '../../state/solverState';
import { forEachTunnelMacroChild } from '../searchShared';
import type { SolveResult, SolveSuccessResult } from '../../api/solverTypes';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'tunnel-level', name: 'Tunnel Macro Test Level', rows });
}

function expectSolved(result: SolveResult): asserts result is SolveSuccessResult {
  expect(result.status).toBe('solved');
}

describe('tunnelMacroPush', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('marks straight corridor cells as tunnel cells', () => {
    const level = buildLevel(['WWWWWWWWW', 'WPBEEEETW', 'WWWWWWWWW']);
    const compiled = compileLevel(level);
    const firstTunnelGlobal = level.width + 3;
    const firstTunnelCell = compiled.globalToCell[firstTunnelGlobal];

    expect(compiled.tunnelDirections[firstTunnelCell]).not.toBe(0);
  });

  it('solves a corridor level by collapsing tunnel pushes', () => {
    const level = buildLevel(['WWWWWWWWW', 'WPBEEEETW', 'WWWWWWWWW']);

    const result = solve(level, 'tunnelMacroPush', undefined, undefined, { nowMs: () => 0 });

    expectSolved(result);
    expect(result.metrics.pushCount).toBeGreaterThan(1);
  });

  it('stops tunnel macro expansion at corridor boundaries', () => {
    const level = buildLevel(['WWWWWWWWW', 'WPBEEEETW', 'WWWWWEWWW', 'WWWWWWWWW']);
    const compiled = compileLevel(level);
    const zobrist = createZobristTable(compiled.cellCount);
    const state = createInitialSolverState(level, compiled, zobrist);
    const childPushes: number[] = [];

    forEachTunnelMacroChild(compiled, state, zobrist, (child) => {
      childPushes.push(child.pushes?.length ?? 1);
    });

    expect(childPushes).toContain(3);
    expect(childPushes.every((count) => count < 5)).toBe(true);
  });
});
