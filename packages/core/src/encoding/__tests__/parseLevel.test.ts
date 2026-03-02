import { describe, expect, it } from 'vitest';

import type { LevelDefinition } from '@corgiban/levels';
import { MAX_BOXES, MAX_GRID_HEIGHT, MAX_GRID_WIDTH } from '@corgiban/shared';

import { parseLevel } from '../parseLevel';
import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../../model/cell';

describe('parseLevel', () => {
  it('parses tokens with common indentation and preserves internal spaces', () => {
    const definition: LevelDefinition = {
      id: 'test-1',
      name: 'Test 1',
      rows: ['  WPE', '  W B', '  WTW'],
    };

    const level = parseLevel(definition);

    expect(level.levelId).toBe(definition.id);
    expect(level.width).toBe(3);
    expect(level.height).toBe(3);
    expect(level.initialPlayerIndex).toBe(1);
    expect(Array.from(level.initialBoxes)).toEqual([5]);
    expect(level.staticGrid[0]).toBe(STATIC_WALL);
    expect(level.staticGrid[1]).toBe(STATIC_FLOOR);
    expect(level.staticGrid[4]).toBe(STATIC_FLOOR);
    expect(level.staticGrid[7]).toBe(STATIC_TARGET);
  });

  it('accepts ragged right edges and pads with floor', () => {
    const definition: LevelDefinition = {
      id: 'ragged-right',
      name: 'Ragged Right',
      rows: ['WPE', 'WB', 'WT'],
    };

    const level = parseLevel(definition);

    expect(level.width).toBe(3);
    expect(level.height).toBe(3);
    expect(level.initialPlayerIndex).toBe(1);
    expect(Array.from(level.initialBoxes)).toEqual([4]);
    expect(level.staticGrid[5]).toBe(STATIC_FLOOR);
  });

  it('parses Q as player on target', () => {
    const definition: LevelDefinition = {
      id: 'player-target',
      name: 'Player Target',
      rows: ['WQW', 'WWW'],
    };

    const level = parseLevel(definition);

    expect(level.initialPlayerIndex).toBe(1);
    expect(level.staticGrid[1]).toBe(STATIC_TARGET);
  });

  it('parses S as box on target', () => {
    const definition: LevelDefinition = {
      id: 'box-target',
      name: 'Box Target',
      rows: ['WSW', 'WPB'],
    };

    const level = parseLevel(definition);

    expect(Array.from(level.initialBoxes)).toEqual([1, 5]);
    expect(level.staticGrid[1]).toBe(STATIC_TARGET);
  });

  it('rejects levels with all boxes on targets at start', () => {
    const definition: LevelDefinition = {
      id: 'all-targets',
      name: 'All Targets',
      rows: ['WSW', 'WPW'],
    };

    expect(() => parseLevel(definition)).toThrow('all boxes on targets');
  });

  it('rejects levels with all boxes on targets at start with many boxes', () => {
    const definition: LevelDefinition = {
      id: 'all-targets-max',
      name: 'All Targets Max',
      rows: [`P${'S'.repeat(MAX_BOXES)}`],
    };

    expect(() => parseLevel(definition)).toThrow('all boxes on targets');
  });

  it('keeps extra indentation beyond the common prefix as floor', () => {
    const definition: LevelDefinition = {
      id: 'mixed-indent',
      name: 'Mixed Indent',
      rows: ['  WPE', '    W B', '  WTW'],
    };

    const level = parseLevel(definition);

    expect(level.width).toBe(5);
    expect(level.initialPlayerIndex).toBe(1);
    expect(level.staticGrid[1]).toBe(STATIC_FLOOR);
  });

  it('rejects rows that are only whitespace', () => {
    const definition: LevelDefinition = {
      id: 'blank-rows',
      name: 'Blank Rows',
      rows: ['   ', ''],
    };

    expect(() => parseLevel(definition)).toThrow('rows must not be empty');
  });

  it('rejects tabs in rows', () => {
    const definition: LevelDefinition = {
      id: 'tabs',
      name: 'Tabs',
      rows: ['\tWPE', 'WPW'],
    };

    expect(() => parseLevel(definition)).toThrow('Tabs are not allowed');
  });

  it('rejects unknown tokens', () => {
    const definition: LevelDefinition = {
      id: 'bad-token',
      name: 'Bad Token',
      rows: ['WVW', 'WPW', 'WWW'],
    };

    expect(() => parseLevel(definition)).toThrow('Unknown token');
  });

  it('rejects missing player', () => {
    const definition: LevelDefinition = {
      id: 'no-player',
      name: 'No Player',
      rows: ['WWW', 'WBW', 'WWW'],
    };

    expect(() => parseLevel(definition)).toThrow('exactly one player');
  });

  it('rejects multiple players', () => {
    const definition: LevelDefinition = {
      id: 'two-players',
      name: 'Two Players',
      rows: ['WPW', 'WQW', 'WWW'],
    };

    expect(() => parseLevel(definition)).toThrow('exactly one player');
  });

  it('enforces MAX_GRID_WIDTH', () => {
    const definition: LevelDefinition = {
      id: 'too-wide',
      name: 'Too Wide',
      rows: ['W'.repeat(MAX_GRID_WIDTH + 1)],
    };

    expect(() => parseLevel(definition)).toThrow(`MAX_GRID_WIDTH ${MAX_GRID_WIDTH}`);
  });

  it('enforces MAX_GRID_HEIGHT', () => {
    const rows = Array.from({ length: MAX_GRID_HEIGHT + 1 }, (_, index) =>
      index === 0 ? 'P' : 'W',
    );
    const definition: LevelDefinition = {
      id: 'too-tall',
      name: 'Too Tall',
      rows,
    };

    expect(() => parseLevel(definition)).toThrow(`MAX_GRID_HEIGHT ${MAX_GRID_HEIGHT}`);
  });

  it('enforces MAX_BOXES', () => {
    const definition: LevelDefinition = {
      id: 'too-many-boxes',
      name: 'Too Many Boxes',
      rows: [`P${'B'.repeat(MAX_BOXES + 1)}`],
    };

    expect(() => parseLevel(definition)).toThrow(`MAX_BOXES ${MAX_BOXES}`);
  });

  it('counts boxes on targets toward MAX_BOXES', () => {
    const definition: LevelDefinition = {
      id: 'too-many-boxes-on-targets',
      name: 'Too Many Boxes On Targets',
      rows: [`P${'S'.repeat(MAX_BOXES + 1)}`],
    };

    expect(() => parseLevel(definition)).toThrow(`MAX_BOXES ${MAX_BOXES}`);
  });
});
