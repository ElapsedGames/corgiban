import { describe, expect, it } from 'vitest';

import { serializeXsb } from '../serializeXsb';

describe('serializeXsb', () => {
  it('serializes internal rows to XSB tokens with title header by default', () => {
    const text = serializeXsb({
      id: 'demo-1',
      name: 'Demo',
      rows: ['WWWWW', 'WTQEW', 'WEBEW', 'WETEW', 'WWWWW'],
      knownSolution: null,
    });

    expect(text).toContain('; Demo (demo-1)');
    expect(text).toContain('#####');
    expect(text).toContain('.+ ');
  });

  it('can omit title header', () => {
    const text = serializeXsb(
      {
        id: 'demo-1',
        name: 'Demo',
        rows: ['WWWWW'],
        knownSolution: null,
      },
      { includeTitleComment: false },
    );

    expect(text).toBe('#####');
  });
});
