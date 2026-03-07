import { describe, expect, it } from 'vitest';

import { parseXsb } from '../parseXsb';
import { parseSok017 } from '../parseSok017';

describe('parseSok017', () => {
  it('supports Title metadata and RLE row expansion with separators', () => {
    const collection = parseSok017(`Title: Packed\n5#|#.@ #|# $ #|# . #|5#`);

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0].name).toBe('Packed');
    expect(collection.levels[0].rows[0]).toBe('WWWWW');
  });

  it('parses multiple levels separated by blank lines and normalizes floor aliases', () => {
    const collection = parseSok017(
      [
        '; First',
        '5#|#@-_#|#$. #|5#',
        '',
        'Title: Second',
        '#####',
        '#.@ #',
        '# $ #',
        '# . #',
        '#####',
      ].join('\n'),
    );

    expect(collection.levels).toHaveLength(2);
    expect(collection.levels[0]).toMatchObject({
      name: 'First',
      rows: ['WWWWW', 'WPEEW', 'WBTEW', 'WWWWW'],
      knownSolution: null,
    });
    expect(collection.levels[1]?.name).toBe('Second');
  });

  it('throws on malformed RLE content', () => {
    expect(() => parseSok017('Title: Broken\n3')).toThrow('trailing digit');
  });

  it('rejects zero repeat counts instead of normalizing them to one', () => {
    expect(() => parseSok017('Title: Broken\n0#|#@  #|# $.#|5#')).toThrow(
      'repeat count must be greater than zero',
    );
  });

  it('rejects tiny RLE payloads that would decode beyond MAX_GRID_WIDTH', () => {
    expect(() => parseSok017('32#33#')).toThrow('MAX_GRID_WIDTH');
  });

  it('rejects tiny RLE payloads that would decode beyond MAX_GRID_HEIGHT', () => {
    expect(() => parseSok017('32|33|')).toThrow('MAX_GRID_HEIGHT');
  });

  it('uses comment titles, collection options, and sanitized fallback ids', () => {
    const collection = parseSok017('; !!!\n5#|#@  #|# $.#|5#|', {
      collectionId: 'pack',
      collectionTitle: 'Pack Import',
    });

    expect(collection.id).toBe('pack');
    expect(collection.title).toBe('Pack Import');
    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]?.id).toBe('pack-001-level');
    expect(collection.levels[0]?.name).toBe('!!!');
    expect(collection.warnings[0]?.levelId).toBe('pack-001-level');
  });

  it('falls back to generated names when Title metadata is blank', () => {
    const collection = parseSok017('Title:\n5#|#@  #|# $.#|5#', {
      collectionId: 'custom',
    });

    expect(collection.levels[0]?.id).toBe('custom-001-level');
    expect(collection.levels[0]?.name).toBe('SOK 1');
  });

  it('throws on unsupported non-board lines', () => {
    expect(() => parseSok017('Title: Broken\nThis is not a board row\n5#|#@ #|#$.#|5#')).toThrow(
      'Unsupported SOK 0.17 line',
    );
  });

  it('rejects Title metadata that appears after board rows have started', () => {
    expect(() => parseSok017('#####\nTitle: Later\n#@  #\n# $.#\n#####')).toThrow(
      'Unsupported SOK 0.17 line: "Title: Later".',
    );
  });

  it('keeps unsupported variants strict by default and carries them when explicitly allowed', () => {
    const input = 'Title: Variant\n####\n#@a#\n#$.#\n####';

    expect(() =>
      parseSok017(input, {
        allowUnsupportedVariants: false,
      }),
    ).toThrow('Unsupported variant tokens detected: multiban.');

    const collection = parseSok017(input, {
      allowUnsupportedVariants: true,
    });

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]?.name).toBe('Variant');
    expect(collection.warnings).toContainEqual({
      code: 'unsupported-variant-carried',
      message: 'Unsupported variants retained in diagnostics: multiban.',
      levelId: 'sok-001-variant',
    });
  });

  it('throws when the file contains only blank lines or comments', () => {
    expect(() => parseSok017('\n; comment only\n\nTitle:\n')).toThrow(
      'No SOK 0.17 levels were found.',
    );
  });

  it('preserves raw row whitespace instead of trimming board lines', () => {
    const board = [' ####', '##  #', '#.@ #', '# $ #', '# . #', '#####'].join('\n');

    const sok = parseSok017(`Title: Indented\n${board}`);
    const xsb = parseXsb(`; Indented\n${board}`);

    expect(sok.levels[0]?.rows).toEqual(xsb.levels[0]?.rows);
  });

  it('ignores semicolon comments that appear after a board has started', () => {
    const collection = parseSok017(
      'Title: Demo\n#####\n; note inside block\n#.@ #\n# $ #\n# . #\n#####',
    );

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]).toMatchObject({
      name: 'Demo',
      rows: ['WWWWW', 'WTPEW', 'WEBEW', 'WETEW', 'WWWWW'],
    });
  });
});
