import { describe, expect, it } from 'vitest';

import { builtinLevels } from '../builtinLevels';
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
  it('normalizes knownSolution and preserves fields', () => {
    const normalized = normalizeLevelDefinition({
      id: 'classic-001',
      name: 'Classic 1',
      rows: ['WEPT'],
      knownSolution: 'lurd',
    });

    expect(normalized.knownSolution).toBe('lurd');
    expect(normalized.id).toBe('classic-001');
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
});
