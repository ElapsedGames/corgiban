import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { createZobristTable } from '../../infra/zobrist';
import { compileLevel } from '../../state/compiledLevel';
import { createInitialSolverState } from '../../state/solverState';
import { estimateAssignmentCost } from '../assignment';

function buildContext(rows: string[]) {
  const level = parseLevel({ id: 'assignment', name: 'Assignment', rows });
  const compiled = compileLevel(level);
  const zobrist = createZobristTable(compiled.cellCount);
  const state = createInitialSolverState(level, compiled, zobrist);

  return { compiled, state };
}

describe('estimateAssignmentCost', () => {
  it('returns zero when there are no boxes or goals to assign', () => {
    const { compiled, state } = buildContext(['P']);

    expect(state.boxes).toHaveLength(0);
    expect(compiled.goalDistances).toHaveLength(0);
    expect(estimateAssignmentCost(compiled, state.boxes)).toBe(0);
  });

  it('returns the impossible-cost sentinel when goals are fewer than boxes', () => {
    const { compiled, state } = buildContext(['WWWWWW', 'WPBBTW', 'WWWWWW']);

    expect(compiled.goalDistances).toHaveLength(1);
    expect(state.boxes).toHaveLength(2);
    expect(estimateAssignmentCost(compiled, state.boxes)).toBe(2_000_000);
  });

  it('treats unreachable goal assignments as impossible', () => {
    const { compiled, state } = buildContext(['WWWWWWW', 'WPBWWTW', 'WEEEWEW', 'WWWWWWW']);

    expect(compiled.goalDistances[0]?.[state.boxes[0]]).toBe(0xffff);
    expect(estimateAssignmentCost(compiled, state.boxes)).toBe(1_000_000);
  });
});
