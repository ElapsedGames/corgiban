import { describe, expect, it } from 'vitest';

import type { LevelDefinition } from '@corgiban/levels';

import { parseLevel } from '../parseLevel';
import { serializeLevel } from '../serializeLevel';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';
import type { LevelRuntime } from '../../model/level';

function expectRuntimeEqual(left: LevelRuntime, right: LevelRuntime) {
  expect(left.levelId).toBe(right.levelId);
  expect(left.width).toBe(right.width);
  expect(left.height).toBe(right.height);
  expect(left.initialPlayerIndex).toBe(right.initialPlayerIndex);
  expect(Array.from(left.initialBoxes)).toEqual(Array.from(right.initialBoxes));
  expect(Array.from(left.staticGrid)).toEqual(Array.from(right.staticGrid));
}

describe('serializeLevel', () => {
  it('serializes canonical tokens for the initial layout', () => {
    const level: LevelRuntime = {
      levelId: 'serialize-test',
      width: 3,
      height: 2,
      staticGrid: Uint8Array.from([
        STATIC_WALL,
        STATIC_TARGET,
        STATIC_FLOOR,
        STATIC_WALL,
        STATIC_TARGET,
        STATIC_FLOOR,
      ]),
      initialPlayerIndex: 1,
      initialBoxes: Uint32Array.from([2, 4]),
    };

    expect(serializeLevel(level)).toEqual(['WQB', 'WSE']);
  });

  it('round-trips parse -> serialize -> parse', () => {
    const definition: LevelDefinition = {
      id: 'round-trip',
      name: 'Round Trip',
      rows: ['WWWWW', 'WQBEW', 'WTSBW', 'WWWWW'],
    };

    const parsed = parseLevel(definition);
    const serialized = serializeLevel(parsed);
    const reparsed = parseLevel({ ...definition, rows: serialized });

    expectRuntimeEqual(parsed, reparsed);
  });

  it('throws when staticGrid size does not match width*height', () => {
    const level: LevelRuntime = {
      levelId: 'invalid-grid',
      width: 2,
      height: 2,
      staticGrid: Uint8Array.from([STATIC_WALL, STATIC_WALL, STATIC_WALL]),
      initialPlayerIndex: 0,
      initialBoxes: Uint32Array.from([]),
    };

    expect(() => serializeLevel(level)).toThrow('staticGrid size');
  });

  it('throws when the player overlaps a box', () => {
    const level: LevelRuntime = {
      levelId: 'overlap',
      width: 2,
      height: 1,
      staticGrid: Uint8Array.from([STATIC_FLOOR, STATIC_FLOOR]),
      initialPlayerIndex: 1,
      initialBoxes: Uint32Array.from([1]),
    };

    expect(() => serializeLevel(level)).toThrow('overlapping player and box');
  });
});
