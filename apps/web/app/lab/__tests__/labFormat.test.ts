import { describe, expect, it } from 'vitest';

import { MAX_IMPORT_BYTES } from '@corgiban/shared';

import { defaultLabLevelText, parseLabInput } from '../labFormat';

describe('labFormat.parseLabInput', () => {
  it('returns default lab text that can be parsed as XSB', () => {
    const text = defaultLabLevelText();
    const parsed = parseLabInput('xsb', text);

    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain(';');
    expect(parsed.level.rows.length).toBeGreaterThan(0);
  });

  it('parses CORG line input', () => {
    const parsed = parseLabInput('corg', 'WWWW\nWPBW\nWETW\nWWWW');
    expect(parsed.level.rows[0]).toBe('WWWW');
    expect(parsed.level.id).toBe('lab-level');
  });

  it('parses CORG JSON input and preserves metadata fields', () => {
    const input = JSON.stringify({
      id: 'custom-lab-id',
      name: 'Custom Lab',
      rows: ['WWWW', 'WPBW', 'WETW', 'WWWW'],
      knownSolution: 'UDLR',
    });

    const parsed = parseLabInput('corg', input);

    expect(parsed.level.id).toBe('custom-lab-id');
    expect(parsed.level.name).toBe('Custom Lab');
    expect(parsed.level.knownSolution).toBe('UDLR');
    expect(parsed.normalizedInput).toContain('\n  "id": "custom-lab-id"');
  });

  it('uses fallback metadata when CORG JSON omits optional fields', () => {
    const parsed = parseLabInput(
      'corg',
      JSON.stringify({
        rows: ['WWWW', 'WPBW', 'WETW', 'WWWW'],
      }),
    );

    expect(parsed.level.id).toBe('lab-level');
    expect(parsed.level.name).toBe('Lab Level');
    expect(parsed.level.knownSolution).toBeNull();
  });

  it('normalizes CORG JSON using the validated level shape instead of raw parsed fields', () => {
    const parsed = parseLabInput(
      'corg',
      JSON.stringify({
        id: 42,
        name: false,
        rows: ['WWWW', 'WPBW', 'WETW', 'WWWW'],
        knownSolution: { bad: true },
      }),
    );

    expect(parsed.normalizedInput).toBe(
      JSON.stringify(
        {
          id: 'lab-level',
          name: 'Lab Level',
          rows: ['WWWW', 'WPBW', 'WETW', 'WWWW'],
          knownSolution: null,
        },
        null,
        2,
      ),
    );
  });

  it('normalizes line-based CORG input with CRLF newlines', () => {
    const parsed = parseLabInput('corg', 'WWWW\r\nWPBW\r\nWETW\r\nWWWW');

    expect(parsed.level.rows).toEqual(['WWWW', 'WPBW', 'WETW', 'WWWW']);
    expect(parsed.normalizedInput).toBe('WWWW\nWPBW\nWETW\nWWWW');
  });

  it('rejects oversized CORG JSON input before JSON parsing', () => {
    const oversized = JSON.stringify({
      rows: ['WWWW', 'WPBW', 'WETW', 'WWWW', 'W'.repeat(MAX_IMPORT_BYTES)],
    });

    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(() => parseLabInput('corg', oversized)).toThrow('Imported level text is too large');
  });

  it('rejects oversized CORG row input before row parsing', () => {
    const level = 'WWWW\nWPBW\nWETW\nWWWW';
    const repeatCount = Math.floor(MAX_IMPORT_BYTES / level.length) + 20;
    const oversized = Array.from({ length: repeatCount }, () => level).join('\n');

    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(() => parseLabInput('corg', oversized)).toThrow('Imported level text is too large');
  });

  it('throws for empty CORG input', () => {
    expect(() => parseLabInput('corg', '  \n \t')).toThrow('CORG input is empty.');
  });

  it('throws for invalid CORG tokens', () => {
    expect(() => parseLabInput('corg', '###')).toThrow('Unknown token');
  });

  it('parses XSB input', () => {
    const parsed = parseLabInput('xsb', '#####\n#.@ #\n# $ #\n# . #\n#####');
    expect(parsed.level.rows[0]).toBe('WWWWW');
  });

  it('parses SOK 0.17 input', () => {
    const parsed = parseLabInput('sok-0.17', 'Title: Demo\n5#|#.@ #|# $ #|# . #|5#');
    expect(parsed.level.rows[0]).toBe('WWWWW');
    expect(parsed.normalizedFormat).toBe('sok-0.17');
    expect(parsed.normalizedInput).toContain('Title: Demo');
  });

  it('parses SLC XML input', () => {
    const parsed = parseLabInput(
      'slc-xml',
      '<Collection><Level Id="a" Name="A"><L>#####</L><L>#.@ #</L><L># $ #</L><L># . #</L><L>#####</L></Level></Collection>',
    );
    expect(parsed.level.rows[0]).toBe('WWWWW');
    expect(parsed.normalizedFormat).toBe('slc-xml');
    expect(parsed.normalizedInput).toContain('<Collection>');
    expect(parsed.normalizedInput).toContain('<L>#.@ #</L>');
  });
});
