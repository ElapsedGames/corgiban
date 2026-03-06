import { describe, expect, it } from 'vitest';

import { parseSlcXml } from '../parseSlcXml';
import { serializeSlcXml } from '../serializeSlcXml';

describe('serializeSlcXml', () => {
  it('serializes a level to canonical SLC XML with an XML declaration', () => {
    const text = serializeSlcXml({
      id: 'demo&level',
      name: 'Demo <Level>',
      rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
    });

    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(text).toContain('<Level Id="demo&amp;level" Name="Demo &lt;Level&gt;">');
    expect(text).toContain('<L>#@ .#</L>');
  });

  it('round-trips through parseSlcXml without changing the normalized rows', () => {
    const text = serializeSlcXml({
      id: 'roundtrip',
      name: 'Roundtrip',
      rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
    });

    const collection = parseSlcXml(text, { collectionId: 'lab' });
    expect(collection.levels[0]).toMatchObject({
      name: 'Roundtrip',
      rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
    });
  });

  it('omits the XML declaration when requested', () => {
    const text = serializeSlcXml(
      {
        id: 'demo',
        name: 'Demo',
        rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
      },
      { includeXmlDeclaration: false },
    );

    expect(text.startsWith('<?xml')).toBe(false);
    expect(parseSlcXml(text).levels[0]).toMatchObject({
      name: 'Demo',
      rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
    });
  });

  it('escapes apostrophes and quotes in attribute values', () => {
    const text = serializeSlcXml({
      id: `demo'"level`,
      name: `Demo's "Level"`,
      rows: ['WWWWW', 'WPETW', 'WBETW', 'WWWWW'],
    });

    expect(text).toContain(`Id="demo&apos;&quot;level"`);
    expect(text).toContain(`Name="Demo&apos;s &quot;Level&quot;"`);
  });
});
