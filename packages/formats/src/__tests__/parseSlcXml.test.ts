import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { describe, expect, it } from 'vitest';

import { parseSlcXml } from '../parseSlcXml';

describe('parseSlcXml', () => {
  it('parses SLC-like XML levels and row tags', () => {
    const xml = `<Collection><Level Id="alpha" Name="Alpha"><L>#####</L><L>#.@ #</L><L># $ #</L><L># . #</L><L>#####</L></Level></Collection>`;
    const collection = parseSlcXml(xml);

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0].name).toBe('Alpha');
    expect(collection.levels[0].rows[0]).toBe('WWWWW');
  });

  it('supports namespaced tags, CDATA row text, and numeric entity titles', () => {
    const xml = `
      <slc:Collection xmlns:slc="urn:test">
        <slc:Level slc:Id="alpha" slc:Title="&#x41;&#108;&#112;&#104;&#97;">
          <slc:L><![CDATA[#####]]></slc:L>
          <slc:L><![CDATA[#.@ #]]></slc:L>
          <slc:L><![CDATA[# $ #]]></slc:L>
          <slc:L><![CDATA[# . #]]></slc:L>
          <slc:L><![CDATA[#####]]></slc:L>
        </slc:Level>
      </slc:Collection>
    `;

    const collection = parseSlcXml(xml, { collectionId: 'ns' });

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]).toMatchObject({
      id: 'ns-001-alpha',
      name: 'Alpha',
      rows: ['WWWWW', 'WTPEW', 'WEBEW', 'WETEW', 'WWWWW'],
    });
  });

  it('supports XML declarations, DOCTYPE declarations, comments, single-quoted attributes, and row-tag attributes', () => {
    const xml = `
      <?xml version='1.0' encoding='UTF-8'?>
      <!DOCTYPE Collection [
        <!ELEMENT Collection (Level+)>
        <!ELEMENT Level (Rows)>
      ]>
      <Collection>
        <!-- Alpha level -->
        <Level id='alpha&amp;beta' title='A &lt; B'>
          <Rows>
            <Row index='1'>#####</Row>
            <Row index='2'>#.@ #</Row>
            <Row index='3'># $ #</Row>
            <Row index='4'># . #</Row>
            <Row index='5'>#####</Row>
          </Rows>
        </Level>
        <Level>
          <Line role='board'>#####</Line>
          <Line role='board'>#.@ #</Line>
          <Line role='board'># $ #</Line>
          <Line role='board'># . #</Line>
          <Line role='board'>#####</Line>
        </Level>
      </Collection>
    `;

    const collection = parseSlcXml(xml, {
      collectionId: 'pack',
      collectionTitle: 'XML Pack',
    });

    expect(collection.id).toBe('pack');
    expect(collection.title).toBe('XML Pack');
    expect(collection.levels).toHaveLength(2);
    expect(collection.levels[0]?.id).toBe('pack-001-alpha-beta');
    expect(collection.levels[0]?.name).toBe('A < B');
    expect(collection.levels[1]?.id).toBe('pack-002-level');
    expect(collection.levels[1]?.name).toBe('SLC 2');
  });

  it('supports simple DOCTYPE declarations without an internal subset', () => {
    const collection = parseSlcXml(
      '<!DOCTYPE Collection><Collection><Level Id="alpha" Name="Alpha"><L>#####</L><L>#.@ #</L><L># $ #</L><L># . #</L><L>#####</L></Level></Collection>',
    );

    expect(collection.levels).toHaveLength(1);
    expect(collection.levels[0]?.id).toContain('alpha');
  });

  it('throws when no levels are present', () => {
    expect(() => parseSlcXml('<Collection />')).toThrow('No <Level> entries');
  });

  it('throws when a level entry does not contain any rows', () => {
    expect(() => parseSlcXml('<Collection><Level id="missing-rows"></Level></Collection>')).toThrow(
      'SLC XML level 1 does not include row entries.',
    );
  });

  it('rejects nested markup inside row tags', () => {
    expect(() =>
      parseSlcXml(
        '<Collection><Level><L>##<Cell>#</Cell></L><L>#.@ #</L><L># $ #</L><L># . #</L><L>#####</L></Level></Collection>',
      ),
    ).toThrow('SLC XML row tags may contain text only.');
  });

  it('rejects unquoted attribute values', () => {
    expect(() =>
      parseSlcXml(
        '<Collection><Level id=alpha><L>#####</L><L>#.@ #</L><L># $ #</L><L># . #</L><L>#####</L></Level></Collection>',
      ),
    ).toThrow('expected a quoted attribute value');
  });

  it('throws on malformed XML instead of silently regex-matching partial content', () => {
    expect(() =>
      parseSlcXml(
        '<Collection><Level id="broken"><Row>#####</Row><Line>#.@ #</Row></Level></Collection>',
      ),
    ).toThrow('Malformed SLC XML');
  });

  it('rejects unterminated processing instructions and unclosed tags', () => {
    expect(() => parseSlcXml('<?xml version="1.0"<Collection />')).toThrow(
      'Malformed SLC XML: unterminated processing instruction.',
    );
    expect(() => parseSlcXml('<Collection><Level><L>#####</L>')).toThrow(
      'Malformed SLC XML: unclosed <level> tag.',
    );
  });

  it('throws on unterminated DOCTYPE declarations', () => {
    expect(() =>
      parseSlcXml(
        '<!DOCTYPE Collection [ <!ELEMENT Collection (Level+)> <Collection><Level><L>#####</L></Level></Collection>',
      ),
    ).toThrow('Malformed SLC XML: unterminated DOCTYPE declaration.');
  });

  it('rejects oversized multi-level XML payloads before parsing level entries', () => {
    const level =
      '<Level Id="alpha" Name="Alpha"><L>#####</L><L>#.@ #</L><L># $ #</L><L># . #</L><L>#####</L></Level>';
    const repeatCount = Math.floor(MAX_IMPORT_BYTES / level.length) + 20;
    const oversized = `<Collection>${Array.from({ length: repeatCount }, () => level).join('')}</Collection>`;

    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(MAX_IMPORT_BYTES);
    expect(() => parseSlcXml(oversized)).toThrow('Imported level text is too large');
  });
});
