import { describe, expect, it } from 'vitest';

import { normalizeAsciiText } from '../normalizeAsciiText';

describe('normalizeAsciiText', () => {
  it('leaves ASCII text unchanged', () => {
    expect(normalizeAsciiText('Plain ASCII text.')).toEqual({
      text: 'Plain ASCII text.',
      changed: false,
    });
  });

  it('strips a UTF-8 BOM prefix', () => {
    expect(normalizeAsciiText('\uFEFFascii text')).toEqual({
      text: 'ascii text',
      changed: true,
    });
  });

  it('normalizes curly quotes and apostrophes', () => {
    expect(normalizeAsciiText('\u201Cquoted\u201D and \u2018apostrophe\u2019')).toEqual({
      text: '"quoted" and \'apostrophe\'',
      changed: true,
    });
  });

  it('normalizes dashes, ellipsis, arrows, and <= symbols', () => {
    expect(normalizeAsciiText('one\u2014two\u2013three\u2026 go \u2192 stop \u2264 max')).toEqual({
      text: 'one-two-three... go -> stop <= max',
      changed: true,
    });
  });

  it('leaves unrelated non-ASCII characters untouched for the validator to report', () => {
    expect(normalizeAsciiText('snowman \u2603')).toEqual({
      text: 'snowman \u2603',
      changed: false,
    });
  });
});
