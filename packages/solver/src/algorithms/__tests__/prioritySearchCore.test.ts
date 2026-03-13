import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseLevel } from '@corgiban/core';

import type { AlgorithmInput } from '../../api/algorithm';
import { normalizeSolverOptions } from '../../api/solverOptions';
import type { SolverOptions } from '../../api/solverTypes';
import { createCancelToken } from '../../infra/cancelToken';
import type { ZobristTable } from '../../infra/zobrist';
import { createZobristTable } from '../../infra/zobrist';
import { cellIdFromGlobal, compileLevel, globalIndexFromCell } from '../../state/compiledLevel';
import { createInitialSolverState, createSolverState } from '../../state/solverState';
import { solvePriorityPushSearch } from '../prioritySearchCore';

function buildInput(
  rows: string[],
  options?: SolverOptions,
  context: AlgorithmInput['context'] = { nowMs: () => 0 },
): AlgorithmInput {
  const level = parseLevel({ id: 'priority-search', name: 'Priority Search', rows });
  const compiled = compileLevel(level);
  const zobrist = createZobristTable(compiled.cellCount);

  return {
    level,
    compiled,
    zobrist,
    options: normalizeSolverOptions('tunnelMacroPush', options),
    context,
  };
}

const computePriority = (depth: number, heuristic: number, weight: number) =>
  depth + heuristic * weight;

function createCollidingZobrist(cellCount: number): ZobristTable {
  return {
    boxHi: new Uint32Array(cellCount),
    boxLo: new Uint32Array(cellCount),
    playerHi: new Uint32Array(cellCount),
    playerLo: new Uint32Array(cellCount),
  };
}

describe('solvePriorityPushSearch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reconstructs multi-push child segments into a full solution', () => {
    const input = buildInput(['WWWWWWW', 'WPEBETW', 'WWWWWWW']);
    const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
    const firstBoxCell = initialState.boxes[0];
    const secondBoxCell = input.compiled.neighbors[firstBoxCell * 4 + 3];
    const goalCell = input.compiled.neighbors[secondBoxCell * 4 + 3];
    const solvedState = createSolverState(
      input.compiled,
      secondBoxCell,
      Uint16Array.from([goalCell]),
      input.zobrist,
    );

    const result = solvePriorityPushSearch(input, {
      childGenerator: (_input, state, visit) => {
        if (state.hash.hi !== initialState.hash.hi || state.hash.lo !== initialState.hash.lo) {
          return;
        }

        visit({
          state: solvedState,
          push: {
            boxIndex: globalIndexFromCell(input.compiled, firstBoxCell),
            direction: 'R',
          },
          pushes: [
            {
              boxIndex: globalIndexFromCell(input.compiled, firstBoxCell),
              direction: 'R',
            },
            {
              boxIndex: globalIndexFromCell(input.compiled, secondBoxCell),
              direction: 'R',
            },
          ],
        });
      },
      computePriority,
    });

    expect(result.status).toBe('solved');
    if (result.status !== 'solved') {
      return;
    }
    expect(result.solutionMoves).toBe('RRR');
    expect(result.metrics.pushCount).toBe(2);
  });

  it('returns an explicit error when no monotonic clock is available', () => {
    vi.stubGlobal('performance', undefined);

    const result = solvePriorityPushSearch(
      buildInput(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'], undefined, {}),
      {
        childGenerator: () => undefined,
        computePriority,
      },
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.errorMessage).toContain('clock source unavailable');
      expect(result.metrics.elapsedMs).toBe(0);
    }
  });

  it('returns solved immediately for already-solved states', () => {
    const result = solvePriorityPushSearch(buildInput(['P']), {
      childGenerator: () => undefined,
      computePriority,
    });

    expect(result.status).toBe('solved');
    if (result.status !== 'solved') {
      return;
    }
    expect(result.solutionMoves).toBe('');
    expect(result.metrics.pushCount).toBe(0);
    expect(result.metrics.moveCount).toBe(0);
  });

  it('honors a pre-cancelled token before expanding nodes', () => {
    const cancelToken = createCancelToken();
    cancelToken.cancel('stop');

    const result = solvePriorityPushSearch(
      buildInput(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'], undefined, {
        nowMs: () => 0,
        cancelToken,
      }),
      {
        childGenerator: () => undefined,
        computePriority,
      },
    );

    expect(result.status).toBe('cancelled');
    expect(result.metrics.expanded).toBe(0);
  });

  it('times out when the elapsed time exceeds the configured budget', () => {
    let current = 0;
    const nowMs = () => {
      current += 5;
      return current;
    };

    const result = solvePriorityPushSearch(
      buildInput(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'], { timeBudgetMs: 4 }, { nowMs }),
      {
        childGenerator: () => undefined,
        computePriority,
      },
    );

    expect(result.status).toBe('timeout');
    expect(result.metrics.expanded).toBe(0);
  });

  it('times out once the node budget is exhausted on a queued child', () => {
    const input = buildInput(['WWWWWWW', 'WPEBETW', 'WWWWWWW'], { nodeBudget: 1 });
    const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
    const firstBoxCell = initialState.boxes[0];
    const secondBoxCell = input.compiled.neighbors[firstBoxCell * 4 + 3];
    const branchState = createSolverState(
      input.compiled,
      firstBoxCell,
      Uint16Array.from([secondBoxCell]),
      input.zobrist,
    );
    const push = {
      boxIndex: globalIndexFromCell(input.compiled, firstBoxCell),
      direction: 'R' as const,
    };

    const result = solvePriorityPushSearch(input, {
      childGenerator: (_input, state, visit) => {
        if (state.hash.hi !== initialState.hash.hi || state.hash.lo !== initialState.hash.lo) {
          return;
        }

        visit({ state: branchState, push });
      },
      computePriority,
    });

    expect(result.status).toBe('timeout');
    expect(result.metrics.expanded).toBe(1);
  });

  it('returns unsolved when no children are generated', () => {
    const result = solvePriorityPushSearch(buildInput(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW']), {
      childGenerator: () => undefined,
      computePriority,
    });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.generated).toBe(1);
  });

  it('updates duplicate-state costs and ignores stale deeper nodes', () => {
    const input = buildInput(['WWWWWWW', 'WPEBETW', 'WWWWWWW']);
    const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
    const firstBoxCell = initialState.boxes[0];
    const secondBoxCell = input.compiled.neighbors[firstBoxCell * 4 + 3];
    const branchState = createSolverState(
      input.compiled,
      firstBoxCell,
      Uint16Array.from([secondBoxCell]),
      input.zobrist,
    );
    const push = {
      boxIndex: globalIndexFromCell(input.compiled, firstBoxCell),
      direction: 'R' as const,
    };

    const result = solvePriorityPushSearch(input, {
      childGenerator: (_input, state, visit) => {
        if (state.hash.hi !== initialState.hash.hi || state.hash.lo !== initialState.hash.lo) {
          return;
        }

        visit({ state: branchState, push, pushes: [push, push] });
        visit({ state: branchState, push, pushes: [push] });
        visit({ state: branchState, push });
      },
      computePriority,
    });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.generated).toBe(3);
    expect(result.metrics.expanded).toBe(2);
    expect(result.metrics.maxDepth).toBe(1);
    expect(result.metrics.maxFrontier).toBe(2);
  });

  it('falls back to child.push when child.pushes is an empty array', () => {
    const input = buildInput(['WWWWWW', 'WPBTEW', 'WWWWWW']);
    const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
    const boxCell = initialState.boxes[0];
    const goalCell = input.compiled.neighbors[boxCell * 4 + 3];
    const solvedState = createSolverState(
      input.compiled,
      boxCell,
      Uint16Array.from([goalCell]),
      input.zobrist,
    );
    const push = {
      boxIndex: globalIndexFromCell(input.compiled, boxCell),
      direction: 'R' as const,
    };

    const result = solvePriorityPushSearch(input, {
      childGenerator: (_input, state, visit) => {
        if (state.hash.hi !== initialState.hash.hi || state.hash.lo !== initialState.hash.lo) {
          return;
        }

        visit({ state: solvedState, push, pushes: [] });
      },
      computePriority,
    });

    expect(result.status).toBe('solved');
    if (result.status !== 'solved') {
      return;
    }
    expect(result.solutionMoves).toBe('R');
    expect(result.metrics.pushCount).toBe(1);
  });

  it('uses config.weight instead of solver option heuristicWeight when provided', () => {
    const computePrioritySpy = vi.fn(computePriority);

    solvePriorityPushSearch(
      buildInput(['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'], { heuristicWeight: 9 }),
      {
        childGenerator: () => undefined,
        computePriority: computePrioritySpy,
        weight: 2,
      },
    );

    expect(computePrioritySpy).toHaveBeenCalledWith(0, expect.any(Number), 2);
  });

  it('tracks colliding hashes with fingerprint comparisons while honoring hooks and explicit weight', () => {
    const input = buildInput(['WWWWWWWWWWW', 'WPEBEEWEEEW', 'WEEEEEWEEEW', 'WWWWWWWWWWW'], {
      heuristicWeight: 2,
    });
    input.zobrist = createCollidingZobrist(input.compiled.cellCount);
    input.hooks = {
      onProgress: vi.fn(),
    };

    const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
    const initialBox = initialState.boxes[0];
    const movedBox = input.compiled.neighbors[initialBox * 4 + 3];
    const isolatedPlayerCell = cellIdFromGlobal(input.compiled, input.level.width + 7);
    const playerMismatchState = createSolverState(
      input.compiled,
      isolatedPlayerCell,
      Uint16Array.from(initialState.boxes),
      input.zobrist,
    );
    const boxMismatchState = createSolverState(
      input.compiled,
      initialState.player,
      Uint16Array.from([movedBox]),
      input.zobrist,
    );
    const push = {
      boxIndex: globalIndexFromCell(input.compiled, initialBox),
      direction: 'R' as const,
    };

    const result = solvePriorityPushSearch(input, {
      childGenerator: (_input, state, visit) => {
        if (state.player !== initialState.player || state.boxes[0] !== initialState.boxes[0]) {
          return;
        }

        visit({ state: playerMismatchState, push });
        visit({ state: boxMismatchState, push });
      },
      computePriority,
    });

    expect(result.status).toBe('unsolved');
    expect(result.metrics.generated).toBe(3);
    expect(result.metrics.expanded).toBe(3);
    expect(input.hooks.onProgress).toHaveBeenCalled();
  });
});
