import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { describe, expect, it } from 'vitest';

import { parseXsb } from '../parseXsb';

describe('parseXsb', () => {
  it('parses multi-level XSB text with comments as titles', () => {
    const collection = parseXsb(
      `; Intro\n#####\n#.@ #\n# $ #\n# . #\n#####\n\n; Next\n#####\n#.@ #\n# $ #\n# . #\n#####`,
    );

    expect(collection.levels).toHaveLength(2);
    expect(collection.levels[0].name).toBe('Intro');
    expect(collection.levels[1].name).toBe('Next');
    expect(collection.levels[0].rows[0]).toBe('WWWWW');
    expect(collection.warnings.length).toBeGreaterThan(0);
  });

  it('uses plain text lines before a board as the level title', () => {
    const collection = parseXsb('Plain Title\n#####\n#.@ #\n# $ #\n# . #\n#####');

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]).toMatchObject({
      id: 'xsb-001-plain-title',
      name: 'Plain Title',
      rows: ['WWWWW', 'WTPEW', 'WEBEW', 'WETEW', 'WWWWW'],
    });
  });

  it('ignores semicolon comments that appear after a board has started', () => {
    const collection = parseXsb('; Intro\n#####\n; board note\n#.@ #\n# $ #\n# . #\n#####');

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]?.name).toBe('Intro');
    expect(collection.levels[0]?.rows).toEqual(['WWWWW', 'WTPEW', 'WEBEW', 'WETEW', 'WWWWW']);
  });

  it('throws when no board blocks are found', () => {
    expect(() => parseXsb('; metadata only')).toThrow('No XSB levels');
  });

  it('throws when text appears inside an active board block', () => {
    expect(() => parseXsb('#####\nnot a board line\n#####')).toThrow(
      'Unsupported XSB line: "not a board line".',
    );
  });

  it('keeps unsupported variants strict by default and carries them when explicitly allowed', () => {
    const input = '####\n#@1#\n#$.#\n####';

    expect(() =>
      parseXsb(input, {
        allowUnsupportedVariants: false,
      }),
    ).toThrow('Unsupported variant tokens detected: numbered.');

    const collection = parseXsb(input, {
      allowUnsupportedVariants: true,
    });

    expect(collection.levels).toHaveLength(1);
    expect(collection.warnings).toContainEqual({
      code: 'unsupported-variant-carried',
      message: 'Unsupported variants retained in diagnostics: numbered.',
      levelId: 'xsb-001-level',
    });
  });

  it('reports lowercase v as a hexoban variant in XSB flows', () => {
    const input = '#####\n#@v #\n#$. #\n#####';

    expect(() => parseXsb(input)).toThrow('Unsupported variant tokens detected: hexoban.');

    const collection = parseXsb(input, {
      allowUnsupportedVariants: true,
    });

    expect(collection.levels).toHaveLength(1);
    expect(collection.warnings).toContainEqual({
      code: 'unsupported-variant-carried',
      message: 'Unsupported variants retained in diagnostics: hexoban.',
      levelId: 'xsb-001-level',
    });
  });

  it('rejects oversized multi-level payloads before parsing blocks', () => {
    const level = '; Demo\n#####\n#.@ #\n# $ #\n# . #\n#####';
    const repeatCount = Math.floor(MAX_IMPORT_BYTES / level.length) + 20;
    const oversized = Array.from({ length: repeatCount }, () => level).join('\n\n');

    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(() => parseXsb(oversized)).toThrow('Imported level text is too large');
  });
});
