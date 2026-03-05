import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { compileLevel } from '../../state/compiledLevel';
import { buildOccupancy } from '../../state/solverState';
import { computeReachability } from '../reachability';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('computeReachability', () => {
  it('respects occupied cells and reports min reachable cell id', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WEEBW', 'WWWWW']);
    const compiled = compileLevel(level);
    const playerCell = compiled.globalToCell[level.initialPlayerIndex];
    const boxCell = compiled.globalToCell[level.initialBoxes[0]];
    const occupancy = buildOccupancy(compiled.cellCount, Uint16Array.from([boxCell]));

    const result = computeReachability(compiled, playerCell, occupancy);

    expect(result.reachable.has(boxCell)).toBe(false);
    expect(result.count).toBeGreaterThan(0);
    const reachableCells = result.reachable.toArray();
    const min = Math.min(...reachableCells);
    expect(result.minCellId).toBe(min);
  });

  it('throws when the start cell is occupied', () => {
    const level = buildLevel(['WWW', 'WPW', 'WBW', 'WWW']);
    const compiled = compileLevel(level);
    const playerCell = compiled.globalToCell[level.initialPlayerIndex];
    const occupancy = buildOccupancy(compiled.cellCount, Uint16Array.from([playerCell]));

    expect(() => computeReachability(compiled, playerCell, occupancy)).toThrow(
      'Player start cell is occupied by a box.',
    );
  });

  it('returns only the start cell when the player is isolated by walls', () => {
    const level = buildLevel(['WWW', 'WPW', 'WWW']);
    const compiled = compileLevel(level);
    const playerCell = compiled.globalToCell[level.initialPlayerIndex];
    const occupancy = buildOccupancy(compiled.cellCount, new Uint16Array(0));

    const result = computeReachability(compiled, playerCell, occupancy);

    expect(result.count).toBe(1);
    expect(result.minCellId).toBe(playerCell);
    expect(result.reachable.toArray()).toEqual([playerCell]);
  });

  it('throws when the start cell id is out of bounds', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);
    const compiled = compileLevel(level);
    const occupancy = buildOccupancy(compiled.cellCount, new Uint16Array(0));

    expect(() => computeReachability(compiled, -1, occupancy)).toThrow('out of bounds');
    expect(() => computeReachability(compiled, compiled.cellCount, occupancy)).toThrow(
      'out of bounds',
    );
  });
});
