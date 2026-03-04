import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { compileLevel } from '../compiledLevel';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('compileLevel', () => {
  it('compacts cells and builds neighbors/goals', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WTEEW', 'WWWWW']);
    const compiled = compileLevel(level);

    expect(compiled.cellCount).toBe(6);
    expect(compiled.globalToCell[0]).toBe(-1);

    const goalGlobal = 2 * level.width + 1;
    const goalCell = compiled.globalToCell[goalGlobal];
    expect(goalCell).toBeGreaterThanOrEqual(0);
    expect(compiled.goals.has(goalCell)).toBe(true);

    const startGlobal = level.initialPlayerIndex;
    const startCell = compiled.globalToCell[startGlobal];
    const rightGlobal = startGlobal + 1;
    const rightCell = compiled.globalToCell[rightGlobal];
    expect(compiled.neighbors[startCell * 4 + 3]).toBe(rightCell);
  });

  it('marks static corner dead squares and computes goal distances', () => {
    const level = buildLevel(['WWW', 'WPW', 'WBW', 'WTW', 'WWW']);
    const compiled = compileLevel(level);

    const playerCell = compiled.globalToCell[level.initialPlayerIndex];
    const boxCell = compiled.globalToCell[level.initialBoxes[0]];
    const goalGlobal = 3 * level.width + 1;
    const goalCell = compiled.globalToCell[goalGlobal];

    expect(compiled.deadSquares.has(playerCell)).toBe(true);
    expect(compiled.deadSquares.has(boxCell)).toBe(false);
    expect(compiled.deadSquares.has(goalCell)).toBe(false);

    expect(compiled.goalDistances).toHaveLength(1);
    const distances = compiled.goalDistances[0];
    expect(distances[goalCell]).toBe(0);
    expect(distances[boxCell]).toBe(1);
    expect(distances[playerCell]).toBe(2);
  });
});
