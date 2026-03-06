import { MAX_BOXES, MAX_GRID_HEIGHT, MAX_GRID_WIDTH } from '@corgiban/shared';
import { describe, expect, it } from 'vitest';

import { formatRowsToXsb, normalizeImportedGrid } from '../normalizeGrid';

describe('normalizeImportedGrid', () => {
  it('normalizes XSB rows into internal tokens with topology-aware crop', () => {
    const result = normalizeImportedGrid(
      ['    #####', '    #.@ #', '    # $ #', '    # . #', '    #####', ''],
      { source: 'xsb' },
    );

    expect(result.rows).toEqual(['WWWWW', 'WTPEW', 'WEBEW', 'WETEW', 'WWWWW']);
    expect(result.warnings.some((warning) => warning.code === 'closed-puzzle-validated')).toBe(
      true,
    );
  });

  it('rejects open puzzles by default', () => {
    expect(() =>
      normalizeImportedGrid(['@ $.'], {
        source: 'xsb',
      }),
    ).toThrow('open/unclosed');
  });

  it('accepts open puzzles when explicitly allowed and reports the skipped warning', () => {
    const result = normalizeImportedGrid(['@ $.'], {
      source: 'xsb',
      allowOpenPuzzles: true,
    });

    expect(result.rows).toEqual(['PEBT']);
    expect(result.warnings).toContainEqual({
      code: 'open-puzzle-validation-skipped',
      message: 'Open puzzle accepted because allowOpenPuzzles is enabled.',
    });
    expect(result.warnings.some((warning) => warning.code === 'closed-puzzle-validated')).toBe(
      false,
    );
  });

  it('rejects closed puzzles that require exterior floor crop when strictClosedValidation is enabled', () => {
    expect(() =>
      normalizeImportedGrid(['    #####', '    #.@ #', '    # $ #', '    # . #', '    #####'], {
        source: 'xsb',
        strictClosedValidation: true,
      }),
    ).toThrow('require topology crop to remove exterior floor padding');
  });

  it('rejects unsupported variants unless explicitly allowed', () => {
    expect(() =>
      normalizeImportedGrid(['####', '#@1#', '#$.#', '####'], {
        source: 'xsb',
      }),
    ).toThrow('Unsupported variant tokens');

    const result = normalizeImportedGrid(['####', '#@1#', '#$.#', '####'], {
      source: 'xsb',
      allowUnsupportedVariants: true,
    });

    expect(result.unsupportedVariants).toContain('numbered');
    expect(result.warnings.some((warning) => warning.code === 'unsupported-variant-carried')).toBe(
      true,
    );
  });

  it('rejects tabs and all-boxes-on-target starts', () => {
    expect(() =>
      normalizeImportedGrid(['#\t#', '#@*#', '####'], {
        source: 'xsb',
      }),
    ).toThrow('Tabs are not allowed');

    expect(() =>
      normalizeImportedGrid(['####', '#@*#', '####'], {
        source: 'xsb',
      }),
    ).toThrow('all boxes on targets');
  });

  it('sanitizes unsupported variant tokens when explicitly allowed', () => {
    const result = normalizeImportedGrid(['########', '#@a<=> #', '#$ . & #', '########'], {
      source: 'xsb',
      allowUnsupportedVariants: true,
      strictClosedValidation: true,
    });

    expect(result.rows).toEqual(['WWWWWWWW', 'WPEEEEEW', 'WBETEEEW', 'WWWWWWWW']);
    expect(result.unsupportedVariants).toEqual(['hexoban', 'modern', 'multiban']);
    expect(result.warnings).toContainEqual({
      code: 'closed-puzzle-validated',
      message: 'Closed puzzle validation completed in strict mode.',
    });
    expect(result.warnings).toContainEqual({
      code: 'unsupported-variant-carried',
      message: 'Unsupported variants retained in diagnostics: hexoban, modern, multiban.',
    });
  });

  it('rejects oversized imports and unsupported punctuation tokens', () => {
    expect(() =>
      normalizeImportedGrid(['#'.repeat(MAX_GRID_WIDTH + 1)], {
        source: 'xsb',
      }),
    ).toThrow(`width ${MAX_GRID_WIDTH + 1} exceeds MAX_GRID_WIDTH ${MAX_GRID_WIDTH}`);

    expect(() =>
      normalizeImportedGrid(
        Array.from({ length: MAX_GRID_HEIGHT + 1 }, () => '#'),
        {
          source: 'xsb',
        },
      ),
    ).toThrow(`height ${MAX_GRID_HEIGHT + 1} exceeds MAX_GRID_HEIGHT ${MAX_GRID_HEIGHT}`);

    expect(() =>
      normalizeImportedGrid(['####', '#@!#', '#$.#', '####'], {
        source: 'xsb',
      }),
    ).toThrow('Unsupported board token "!" at row 2.');
  });

  it('rejects grids without exactly one player after normalization', () => {
    expect(() =>
      normalizeImportedGrid(['####', '#  #', '#$.#', '####'], {
        source: 'xsb',
      }),
    ).toThrow('Imported level must contain exactly one player.');

    expect(() =>
      normalizeImportedGrid(['#####', '#@+ #', '#$. #', '#####'], {
        source: 'xsb',
      }),
    ).toThrow('Imported level must contain exactly one player.');
  });

  it('rejects levels that exceed MAX_BOXES during import normalization', () => {
    const boxedRow = `#@${'$'.repeat(MAX_BOXES + 1)}#`;
    const wallRow = '#'.repeat(boxedRow.length);

    expect(() =>
      normalizeImportedGrid([wallRow, boxedRow, wallRow], {
        source: 'xsb',
      }),
    ).toThrow(`MAX_BOXES ${MAX_BOXES}`);
  });

  it('serializes internal rows back to XSB tokens and rejects unknown internal cells', () => {
    expect(formatRowsToXsb(['WTPQBSE '])).toEqual(['#.@+$*  ']);
    expect(() => formatRowsToXsb(['Z'])).toThrow('Cannot serialize unknown internal token "Z".');
  });
});
