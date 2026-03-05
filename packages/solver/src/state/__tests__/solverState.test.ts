import { describe, expect, it } from 'vitest';

import { parseLevel } from '@corgiban/core';

import { createZobristTable } from '../../infra/zobrist';
import { compileLevel } from '../compiledLevel';
import {
  buildOccupancy,
  createInitialSolverState,
  createSolverState,
  fingerprintFromState,
} from '../solverState';

function buildLevel(rows: string[]) {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

describe('SolverState', () => {
  it('canonicalizes player position within reachable region', () => {
    const level = buildLevel(['WWWWW', 'WPEEW', 'WEEBW', 'WEEEW', 'WWWWW']);
    const compiled = compileLevel(level);
    const zobrist = createZobristTable(compiled.cellCount, 123);

    const initial = createInitialSolverState(level, compiled, zobrist);

    const alternatePlayerGlobal = 3 * level.width + 2;
    const alternatePlayerCell = compiled.globalToCell[alternatePlayerGlobal];
    const boxCell = compiled.globalToCell[level.initialBoxes[0]];

    const alternate = createSolverState(
      compiled,
      alternatePlayerCell,
      Uint16Array.from([boxCell]),
      zobrist,
    );

    expect(initial.player).toBe(alternate.player);
    expect(initial.hash).toEqual(alternate.hash);
    expect(initial.occupancy.has(boxCell)).toBe(true);
  });

  it('rejects initial player positions on walls', () => {
    const level = {
      levelId: 'invalid-player',
      width: 1,
      height: 1,
      staticGrid: Uint8Array.from([0]),
      initialPlayerIndex: 0,
      initialBoxes: Uint32Array.from([]),
    };
    const compiled = compileLevel(level);
    const zobrist = createZobristTable(compiled.cellCount, 1);

    expect(() => createInitialSolverState(level, compiled, zobrist)).toThrow(
      'Initial player position is not on a walkable cell.',
    );
  });

  it('rejects boxes placed on walls', () => {
    const level = {
      levelId: 'invalid-box',
      width: 1,
      height: 2,
      staticGrid: Uint8Array.from([1, 0]),
      initialPlayerIndex: 0,
      initialBoxes: Uint32Array.from([1]),
    };
    const compiled = compileLevel(level);
    const zobrist = createZobristTable(compiled.cellCount, 2);

    expect(() => createInitialSolverState(level, compiled, zobrist)).toThrow(
      'Box at 1 is not on a walkable cell.',
    );
  });

  it('creates state fingerprints from solver state', () => {
    const boxes = Uint16Array.from([1, 3, 5]);
    const state = {
      boxes,
      player: 2,
      occupancy: buildOccupancy(8, boxes),
      hash: { hi: 11, lo: 22 },
    };

    const fingerprint = fingerprintFromState(state);

    expect(fingerprint.player).toBe(2);
    expect(fingerprint.boxes).toBe(boxes);
    expect(Array.from(fingerprint.boxes)).toEqual([1, 3, 5]);
  });

  it('builds empty occupancy when there are no boxes', () => {
    const occupancy = buildOccupancy(8, Uint16Array.from([]));

    expect(occupancy.size).toBe(8);
    expect(occupancy.toArray()).toEqual([]);
  });

  it('marks a single box at index 0 in occupancy', () => {
    const occupancy = buildOccupancy(4, Uint16Array.from([0]));

    expect(occupancy.has(0)).toBe(true);
    expect(occupancy.toArray()).toEqual([0]);
  });

  it('handles sparse boxes in a large occupancy bitset', () => {
    const occupancy = buildOccupancy(2048, Uint16Array.from([0, 511, 1500, 2047]));

    expect(occupancy.has(0)).toBe(true);
    expect(occupancy.has(511)).toBe(true);
    expect(occupancy.has(1500)).toBe(true);
    expect(occupancy.has(2047)).toBe(true);
    expect(occupancy.has(1)).toBe(false);
    expect(occupancy.has(1024)).toBe(false);
    expect(occupancy.toArray()).toEqual([0, 511, 1500, 2047]);
  });
});
