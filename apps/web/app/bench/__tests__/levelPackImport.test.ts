import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { describe, expect, it } from 'vitest';

import {
  formatLevelPackImportNotice,
  LEVEL_PACK_TYPE,
  LEVEL_PACK_VERSION,
  parseImportedLevelIds,
  resolveLevelPackImport,
} from '../levelPackImport';

const knownLevelIds = new Set(['corgiban-test-18', 'corgiban-test-22']);

describe('levelPackImport', () => {
  it('parses levelIds arrays when every entry is a string', () => {
    const parsed = parseImportedLevelIds(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levelIds: ['corgiban-test-18', 'corgiban-test-22'],
      }),
    );

    expect(parsed).toEqual(['corgiban-test-18', 'corgiban-test-22']);
  });

  it('parses levels arrays using object ids', () => {
    const parsed = parseImportedLevelIds(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levels: [{ id: 'corgiban-test-18' }, { id: 'corgiban-test-22' }],
      }),
    );

    expect(parsed).toEqual(['corgiban-test-18', 'corgiban-test-22']);
  });

  it('throws on invalid level-pack payloads', () => {
    expect(() => parseImportedLevelIds('null')).toThrow('Level pack must be a JSON object.');
    expect(() =>
      parseImportedLevelIds(
        JSON.stringify({
          type: 'other-pack',
          version: LEVEL_PACK_VERSION,
          levelIds: ['corgiban-test-18'],
        }),
      ),
    ).toThrow('Unsupported level pack type.');
    expect(() =>
      parseImportedLevelIds(
        JSON.stringify({
          type: LEVEL_PACK_TYPE,
          version: LEVEL_PACK_VERSION + 1,
          levelIds: ['corgiban-test-18'],
        }),
      ),
    ).toThrow(`Unsupported level pack version. Expected ${LEVEL_PACK_VERSION}.`);
    expect(() => parseImportedLevelIds(JSON.stringify({}))).toThrow('Unsupported level pack type.');
    expect(() =>
      parseImportedLevelIds(
        JSON.stringify({
          type: LEVEL_PACK_TYPE,
          version: LEVEL_PACK_VERSION,
          levelIds: ['corgiban-test-18', 12],
        }),
      ),
    ).toThrow('Level pack levelIds must be a string array.');
    expect(() =>
      parseImportedLevelIds(
        JSON.stringify({
          type: LEVEL_PACK_TYPE,
          version: LEVEL_PACK_VERSION,
          levels: [{ id: 'corgiban-test-18' }, {}],
        }),
      ),
    ).toThrow('Level pack levels entries must include string ids.');
  });

  it('throws when the level pack exceeds the maximum supported size', () => {
    const oversizedPayload = JSON.stringify({
      type: LEVEL_PACK_TYPE,
      version: LEVEL_PACK_VERSION,
      levelIds: ['x'.repeat(MAX_IMPORT_BYTES)],
    });

    expect(() => parseImportedLevelIds(oversizedPayload)).toThrow('Level pack is too large');
  });

  it('prefers top-level levelIds when both supported shapes are present', () => {
    const parsed = parseImportedLevelIds(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levelIds: ['corgiban-test-18'],
        levels: [{ id: 'corgiban-test-22' }],
      }),
    );

    expect(parsed).toEqual(['corgiban-test-18']);
  });

  it('throws when a supported level-pack payload omits both levelIds and levels', () => {
    expect(() =>
      parseImportedLevelIds(
        JSON.stringify({
          type: LEVEL_PACK_TYPE,
          version: LEVEL_PACK_VERSION,
        }),
      ),
    ).toThrow('Level pack is missing levelIds or levels.');
  });

  it('resolves known ids, dedupes recognized entries, and counts skipped ids', () => {
    const summary = resolveLevelPackImport(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levelIds: [
          'corgiban-test-18',
          'custom-001',
          'corgiban-test-18',
          'corgiban-test-22',
          'custom-002',
        ],
      }),
      knownLevelIds,
    );

    expect(summary).toEqual({
      validLevelIds: ['corgiban-test-18', 'corgiban-test-22'],
      importedCount: 5,
      skippedCount: 2,
    });
  });

  it('formats a notice only when unrecognized ids were skipped', () => {
    const noSkipNotice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18'],
      importedCount: 1,
      skippedCount: 0,
    });
    expect(noSkipNotice).toBeNull();

    const notice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18', 'corgiban-test-22'],
      importedCount: 4,
      skippedCount: 2,
    });
    expect(notice).toContain('Imported 2 levels.');
    expect(notice).toContain('2 unrecognized IDs were skipped');
  });

  it('formats singular notice grammar when exactly one id is skipped', () => {
    const notice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18'],
      importedCount: 2,
      skippedCount: 1,
    });

    expect(notice).toBe(
      'Imported 1 level. 1 unrecognized ID was skipped (custom levels are not yet supported).',
    );
  });
});
