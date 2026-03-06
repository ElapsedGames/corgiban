import { describe, expect, it } from 'vitest';

import { parseSok017 } from '../parseSok017';
import { serializeSok017 } from '../serializeSok017';

describe('serializeSok017', () => {
  it('serializes a level to canonical SOK 0.17 text with a title line', () => {
    const text = serializeSok017({
      id: 'demo',
      name: 'Demo',
      rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
    });

    expect(text).toBe('Title: Demo\n#####\n#@ .#\n#$ .#\n#####');
  });

  it('round-trips through parseSok017 without changing the normalized rows', () => {
    const text = serializeSok017({
      id: 'roundtrip',
      name: 'Roundtrip',
      rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
    });

    const collection = parseSok017(text, { collectionId: 'lab' });
    expect(collection.levels[0]).toMatchObject({
      name: 'Roundtrip',
      rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
    });
  });

  it('omits the title line when requested', () => {
    const text = serializeSok017(
      {
        id: 'demo',
        name: 'Demo',
        rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
      },
      { includeTitleLine: false },
    );

    expect(text).toBe('#####\n#@ .#\n#$ .#\n#####');
    expect(text.startsWith('Title:')).toBe(false);
  });
});
