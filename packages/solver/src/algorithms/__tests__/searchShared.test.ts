import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import type { AlgorithmInput } from '../../api/algorithm';
import { normalizeSolverOptions } from '../../api/solverOptions';
import { createCancelToken } from '../../infra/cancelToken';
import { createZobristTable } from '../../infra/zobrist';
import { compileLevel } from '../../state/compiledLevel';
import { createInitialSolverState } from '../../state/solverState';
import { estimateAssignmentCost } from '../../heuristics/assignment';
import { estimateManhattanCost } from '../../heuristics/manhattan';
import {
  buildProgress,
  estimateHeuristic,
  forEachPiCorralChild,
  forEachPushChild,
  forEachTunnelMacroChild,
  isSolved,
  pushKey,
  shouldCancel,
  stateKeyFingerprint,
} from '../searchShared';

function buildContext(rows: string[]) {
  const level = parseLevel({ id: 'search-shared', name: 'Search Shared', rows });
  const compiled = compileLevel(level);
  const zobrist = createZobristTable(compiled.cellCount);
  const state = createInitialSolverState(level, compiled, zobrist);

  return { level, compiled, zobrist, state };
}

function buildInput(rows: string[], heuristicId: 'assignment' | 'manhattan'): AlgorithmInput {
  const { level, compiled, zobrist } = buildContext(rows);

  return {
    level,
    compiled,
    zobrist,
    options: normalizeSolverOptions('astarPush', { heuristicId }),
    context: { nowMs: () => 0 },
  };
}

describe('searchShared helpers', () => {
  it('builds progress snapshots with optional fields only when provided', () => {
    expect(buildProgress(1, 2, 3, 4, 5)).toEqual({
      expanded: 1,
      generated: 2,
      depth: 3,
      frontier: 4,
      elapsedMs: 5,
    });

    expect(buildProgress(1, 2, 3, 4, 5, 6, 'RR')).toEqual({
      expanded: 1,
      generated: 2,
      depth: 3,
      frontier: 4,
      elapsedMs: 5,
      bestHeuristic: 6,
      bestPathSoFar: 'RR',
    });
  });

  it('recognizes solved states from goal occupancy', () => {
    const { compiled, state } = buildContext(['WWWWWWW', 'WPEBETW', 'WWWWWWW']);

    expect(isSolved(compiled, new Uint16Array())).toBe(true);
    expect(isSolved(compiled, state.boxes)).toBe(false);
    expect(isSolved(compiled, Uint16Array.from(compiled.goalCells))).toBe(true);
  });

  it('reads cancellation state from the optional token', () => {
    const cancelToken = createCancelToken();

    expect(shouldCancel(undefined)).toBe(false);
    expect(shouldCancel(cancelToken)).toBe(false);

    cancelToken.cancel('stop');
    expect(shouldCancel(cancelToken)).toBe(true);
  });

  it('routes heuristic estimation to the requested cost model', () => {
    const rows = ['WWWWWWW', 'WPEEEEW', 'WEBBTEW', 'WEEETEW', 'WWWWWWW'];
    const assignmentInput = buildInput(rows, 'assignment');
    const manhattanInput = buildInput(rows, 'manhattan');
    const { compiled, state } = buildContext(rows);

    expect(estimateHeuristic(assignmentInput, state.boxes)).toBe(
      estimateAssignmentCost(compiled, state.boxes),
    );
    expect(estimateHeuristic(manhattanInput, state.boxes)).toBe(
      estimateManhattanCost(compiled, state.boxes),
    );
  });

  it('skips pushes that would land on dead squares', () => {
    const { compiled, state, zobrist } = buildContext(['WWWWW', 'WPBEW', 'WEEEW', 'WWWWW']);
    const children: number[][] = [];

    forEachPushChild(compiled, state, zobrist, (child) => {
      children.push(Array.from(child.state.boxes));
    });

    expect(children).toEqual([]);
  });

  it('returns no tunnel macro child when the first push is invalid', () => {
    const { compiled, state, zobrist } = buildContext(['WWWWW', 'WPBEW', 'WEEEW', 'WWWWW']);
    const children: number[] = [];

    forEachTunnelMacroChild(compiled, state, zobrist, (child) => {
      children.push(child.pushes?.length ?? 1);
    });

    expect(children).toEqual([]);
  });

  it('stops tunnel macro expansion once the box reaches a goal cell', () => {
    const { compiled, state, zobrist } = buildContext(['WWWWWWWW', 'WPBETEEW', 'WWWWWWWW']);
    const lengths: number[] = [];

    forEachTunnelMacroChild(compiled, state, zobrist, (child) => {
      lengths.push(child.pushes?.length ?? 1);
    });

    expect(lengths).toEqual([2]);
  });

  it('filters PI-corral expansions to the detected allowed pushes', () => {
    const { compiled, state, zobrist } = buildContext([
      'WWWWWWW',
      'WWWTWWW',
      'WWEBEWW',
      'WPEEEEW',
      'WWWWWWW',
    ]);
    const allowed = new Set<number>();

    forEachPiCorralChild(compiled, state, zobrist, (child) => {
      const dirIndex = ['U', 'D', 'L', 'R'].indexOf(child.push.direction);
      allowed.add(pushKey(compiled.globalToCell[child.push.boxIndex], dirIndex));
    });

    expect(Array.from(allowed)).toEqual([8]);
  });

  it('exposes stable push and fingerprint helpers for visited-state keys', () => {
    const { state } = buildContext(['WWWWWWW', 'WPEBETW', 'WWWWWWW']);
    const fingerprint = stateKeyFingerprint(state);

    expect(pushKey(3, 2)).toBe(14);
    expect(fingerprint.player).toBe(state.player);
    expect(Array.from(fingerprint.boxes)).toEqual(Array.from(state.boxes));
  });
});
