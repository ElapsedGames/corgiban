import { describe, expect, it } from 'vitest';

import { builtinLevels } from '../corgibanTestLevels';
import {
  normalizeKnownSolution,
  normalizeLevelDefinition,
  validateRowTokens,
} from '../levelSchema';

describe('normalizeKnownSolution', () => {
  it('preserves case and accepts lowercase input', () => {
    expect(normalizeKnownSolution('lurd')).toBe('lurd');
    expect(normalizeKnownSolution('LuRd')).toBe('LuRd');
  });

  it('rejects whitespace and empty strings', () => {
    expect(normalizeKnownSolution('UR DL')).toBeNull();
    expect(normalizeKnownSolution('   ')).toBeNull();
  });

  it('rejects non-UDLR symbols', () => {
    expect(normalizeKnownSolution('URX')).toBeNull();
  });

  it('preserves undefined for not-tested', () => {
    expect(normalizeKnownSolution(undefined)).toBeUndefined();
  });
});

describe('validateRowTokens', () => {
  it('accepts allowed tokens', () => {
    expect(() => validateRowTokens(['WETPBSQ '])).not.toThrow();
  });

  it('rejects unknown tokens with row index', () => {
    expect(() => validateRowTokens(['WEZ'])).toThrow('Z');
    expect(() => validateRowTokens(['WEZ'])).toThrow('row 1');
  });
});

describe('normalizeLevelDefinition', () => {
  function assertNoExteriorFloor(rows: string[]): void {
    const height = rows.length;
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const grid = rows.map((row) => row.padEnd(width, ' ').split(''));
    const seen = Array.from({ length: height }, () => Array(width).fill(false));
    const queue: Array<[number, number]> = [];

    const push = (rowIndex: number, colIndex: number) => {
      if (rowIndex < 0 || rowIndex >= height || colIndex < 0 || colIndex >= width) {
        return;
      }
      if (seen[rowIndex]?.[colIndex]) {
        return;
      }
      if (grid[rowIndex]?.[colIndex] !== ' ') {
        return;
      }
      seen[rowIndex][colIndex] = true;
      queue.push([rowIndex, colIndex]);
    };

    for (let colIndex = 0; colIndex < width; colIndex += 1) {
      push(0, colIndex);
      push(height - 1, colIndex);
    }
    for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
      push(rowIndex, 0);
      push(rowIndex, width - 1);
    }

    while (queue.length > 0) {
      const [rowIndex, colIndex] = queue.shift() ?? [-1, -1];
      push(rowIndex - 1, colIndex);
      push(rowIndex + 1, colIndex);
      push(rowIndex, colIndex - 1);
      push(rowIndex, colIndex + 1);
    }

    for (const row of seen) {
      expect(row.includes(true)).toBe(false);
    }
  }

  it('normalizes knownSolution and preserves fields', () => {
    const normalized = normalizeLevelDefinition({
      id: 'corgiban-test-18',
      name: 'Classic 1',
      rows: ['WEPT'],
      knownSolution: 'lurd',
    });

    expect(normalized.knownSolution).toBe('lurd');
    expect(normalized.id).toBe('corgiban-test-18');
    expect(normalized.name).toBe('Classic 1');
  });

  it('throws on invalid row tokens', () => {
    expect(() =>
      normalizeLevelDefinition({
        id: 'bad-001',
        name: 'Bad 1',
        rows: ['WEZ'],
        knownSolution: undefined,
      }),
    ).toThrow('Z');
  });

  it('keeps builtin knownSolution values normalized (or null/undefined)', () => {
    for (const level of builtinLevels) {
      const value = level.knownSolution;
      if (value === undefined || value === null) {
        continue;
      }
      expect(normalizeKnownSolution(value)).toBe(value);
    }
  });

  it('ships unique builtin ids and row layouts', () => {
    const levelIds = new Set<string>();
    const rowLayouts = new Map<string, string>();

    for (const level of builtinLevels) {
      if (levelIds.has(level.id)) {
        throw new Error(`Duplicate builtin level id: ${level.id}`);
      }
      levelIds.add(level.id);

      const layoutKey = level.rows.join('\n');
      const priorLevelId = rowLayouts.get(layoutKey);
      if (priorLevelId) {
        throw new Error(`Duplicate builtin level layout: ${priorLevelId} and ${level.id}`);
      }
      rowLayouts.set(layoutKey, level.id);
    }
  });

  it('uses space-only floor tokens and closes outside void with walls in builtin levels', () => {
    for (const level of builtinLevels) {
      expect(level.rows.some((row) => row.includes('E'))).toBe(false);
      assertNoExteriorFloor(level.rows);
    }
  });
});
