import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { normalizeSolverOptions } from '../../api/solverOptions';
import type { AlgorithmInput } from '../../api/algorithm';
import type { ZobristTable } from '../../infra/zobrist';
import { createZobristTable } from '../../infra/zobrist';
import { cellIdFromGlobal, compileLevel, globalIndexFromCell } from '../../state/compiledLevel';
import { createInitialSolverState, createSolverState } from '../../state/solverState';

function buildInput(rows: string[]): AlgorithmInput {
  const level = parseLevel({ id: 'astar-branches', name: 'A* Branches', rows });
  const compiled = compileLevel(level);
  const zobrist = createZobristTable(compiled.cellCount);

  return {
    level,
    compiled,
    zobrist,
    options: normalizeSolverOptions('astarPush', undefined),
    context: {
      nowMs: () => 0,
    },
  };
}

function createCollidingZobrist(cellCount: number): ZobristTable {
  return {
    boxHi: new Uint32Array(cellCount),
    boxLo: new Uint32Array(cellCount),
    playerHi: new Uint32Array(cellCount),
    playerLo: new Uint32Array(cellCount),
  };
}

function matchesState(
  left: ReturnType<typeof createInitialSolverState>,
  right: ReturnType<typeof createInitialSolverState>,
): boolean {
  return (
    left.player === right.player && left.boxes.every((box, index) => box === right.boxes[index])
  );
}

describe('astarPush branch coverage', () => {
  afterEach(() => {
    vi.doUnmock('../searchShared');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('skips stale deeper duplicate nodes after a shorter route records the same state', async () => {
    const input = buildInput(['WWWWWWWWW', 'WPEBEEETW', 'WEEEEEEEW', 'WWWWWWWWW']);
    const initialState = createInitialSolverState(input.level, input.compiled, input.zobrist);
    const corridorStart = initialState.boxes[0];
    const firstStep = input.compiled.neighbors[corridorStart * 4 + 3];
    const secondStep = input.compiled.neighbors[firstStep * 4 + 3];
    const thirdStep = input.compiled.neighbors[secondStep * 4 + 3];
    const fourthStep = input.compiled.neighbors[thirdStep * 4 + 3];
    const freePlayerCell = initialState.player;

    const branchAState = createSolverState(
      input.compiled,
      freePlayerCell,
      Uint16Array.from([firstStep]),
      input.zobrist,
    );
    const branchA2State = createSolverState(
      input.compiled,
      freePlayerCell,
      Uint16Array.from([secondStep]),
      input.zobrist,
    );
    const branchBState = createSolverState(
      input.compiled,
      freePlayerCell,
      Uint16Array.from([thirdStep]),
      input.zobrist,
    );
    const duplicateState = createSolverState(
      input.compiled,
      freePlayerCell,
      Uint16Array.from([fourthStep]),
      input.zobrist,
    );

    const initialBox = initialState.boxes[0];
    const branchABox = branchAState.boxes[0];
    const branchA2Box = branchA2State.boxes[0];
    const branchBBox = branchBState.boxes[0];
    const duplicateBox = duplicateState.boxes[0];

    const heuristicByBox = new Map<number, number>([
      [initialBox, 0],
      [branchABox, 0],
      [branchA2Box, 0],
      [branchBBox, 2],
      [duplicateBox, 10],
    ]);

    const pushFromCell = (cellId: number) => ({
      boxIndex: globalIndexFromCell(input.compiled, cellId),
      direction: 'R' as const,
    });

    const forEachPushChild = vi.fn((_compiled, state, _zobrist, visit) => {
      if (state.hash.hi === initialState.hash.hi && state.hash.lo === initialState.hash.lo) {
        visit({ state: branchAState, push: pushFromCell(initialBox) });
        visit({ state: branchBState, push: pushFromCell(initialBox) });
        return;
      }

      if (state.hash.hi === branchAState.hash.hi && state.hash.lo === branchAState.hash.lo) {
        visit({ state: branchA2State, push: pushFromCell(branchABox) });
        return;
      }

      if (state.hash.hi === branchA2State.hash.hi && state.hash.lo === branchA2State.hash.lo) {
        visit({ state: duplicateState, push: pushFromCell(branchA2Box) });
        return;
      }

      if (state.hash.hi === branchBState.hash.hi && state.hash.lo === branchBState.hash.lo) {
        visit({ state: duplicateState, push: pushFromCell(branchBBox) });
      }
    });

    const estimateHeuristic = vi.fn(
      (_input, boxes: Uint16Array) => heuristicByBox.get(boxes[0]) ?? 0,
    );

    vi.doMock('../searchShared', async () => {
      const actual = await vi.importActual<typeof import('../searchShared')>('../searchShared');
      return {
        ...actual,
        estimateHeuristic,
        forEachPushChild,
        isSolved: () => false,
      };
    });

    const { solveAstarPush } = await import('../astarPush');
    const result = solveAstarPush(input);

    expect(result.status).toBe('unsolved');
    expect(result.metrics.generated).toBe(6);
    expect(result.metrics.expanded).toBe(5);
    expect(result.metrics.maxDepth).toBe(2);
    expect(forEachPushChild).toHaveBeenCalledTimes(5);
    expect(estimateHeuristic).toHaveBeenCalled();
  });

  it('distinguishes colliding hash buckets by player and box fingerprints', async () => {
    const input = buildInput(['WWWWWWWWWWW', 'WPEBEEWEEEW', 'WEEEEEWEEEW', 'WWWWWWWWWWW']);
    input.zobrist = createCollidingZobrist(input.compiled.cellCount);
    input.options = normalizeSolverOptions('astarPush', { heuristicWeight: 2 });
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

    vi.doMock('../searchShared', async () => {
      const actual = await vi.importActual<typeof import('../searchShared')>('../searchShared');
      return {
        ...actual,
        estimateHeuristic: () => 0,
        forEachPushChild: vi.fn((_compiled, state, _zobrist, visit) => {
          if (!matchesState(state, initialState)) {
            return;
          }

          visit({ state: playerMismatchState, push });
          visit({ state: boxMismatchState, push });
        }),
        isSolved: () => false,
      };
    });

    const { solveAstarPush } = await import('../astarPush');
    const result = solveAstarPush(input);

    expect(result.status).toBe('unsolved');
    expect(result.metrics.generated).toBe(3);
    expect(result.metrics.expanded).toBe(3);
    expect(input.hooks.onProgress).toHaveBeenCalled();
  });
});
