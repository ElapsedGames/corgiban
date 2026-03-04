import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { compileLevel } from '../../state/compiledLevel';
import { isCornerDeadlock } from '../corners';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('corner deadlocks', () => {
  it('flags corner cells that are not goals', () => {
    const level = buildLevel(['WWW', 'WPW', 'WBW', 'WTW', 'WWW']);
    const compiled = compileLevel(level);

    const playerCell = compiled.globalToCell[level.initialPlayerIndex];
    const boxCell = compiled.globalToCell[level.initialBoxes[0]];
    const goalGlobal = 3 * level.width + 1;
    const goalCell = compiled.globalToCell[goalGlobal];

    expect(isCornerDeadlock(compiled, playerCell)).toBe(true);
    expect(isCornerDeadlock(compiled, boxCell)).toBe(false);
    expect(isCornerDeadlock(compiled, goalCell)).toBe(false);
  });

  it('throws on invalid cell ids', () => {
    const level = buildLevel(['WWW', 'WPW', 'WWW']);
    const compiled = compileLevel(level);

    expect(() => isCornerDeadlock(compiled, -1)).toThrow('out of bounds');
    expect(() => isCornerDeadlock(compiled, compiled.cellCount)).toThrow('out of bounds');
  });

  it('detects all four corner-wall combinations and ignores non-corners', () => {
    const level = buildLevel(['WWWWW', 'WEEEW', 'WEPBW', 'WETEW', 'WWWWW']);
    const compiled = compileLevel(level);

    const topLeft = compiled.globalToCell[1 * level.width + 1];
    const topRight = compiled.globalToCell[1 * level.width + 3];
    const bottomLeft = compiled.globalToCell[3 * level.width + 1];
    const bottomRight = compiled.globalToCell[3 * level.width + 3];
    const center = compiled.globalToCell[2 * level.width + 2];
    const goalCell = compiled.globalToCell[3 * level.width + 2];

    expect(isCornerDeadlock(compiled, topLeft)).toBe(true);
    expect(isCornerDeadlock(compiled, topRight)).toBe(true);
    expect(isCornerDeadlock(compiled, bottomLeft)).toBe(true);
    expect(isCornerDeadlock(compiled, bottomRight)).toBe(true);
    expect(isCornerDeadlock(compiled, center)).toBe(false);
    expect(isCornerDeadlock(compiled, goalCell)).toBe(false);
  });
});
