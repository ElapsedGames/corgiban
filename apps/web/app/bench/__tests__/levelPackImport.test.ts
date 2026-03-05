import { describe, expect, it } from 'vitest';

import {
  formatLevelPackImportNotice,
  parseImportedLevelIds,
  resolveLevelPackImport,
} from '../levelPackImport';

const knownLevelIds = new Set(['classic-001', 'classic-002']);

describe('levelPackImport', () => {
  it('parses levelIds arrays and filters non-string entries', () => {
    const parsed = parseImportedLevelIds(
      JSON.stringify({
        levelIds: ['classic-001', 12, null, 'classic-002'],
      }),
    );

    expect(parsed).toEqual(['classic-001', 'classic-002']);
  });

  it('parses levels arrays using object ids', () => {
    const parsed = parseImportedLevelIds(
      JSON.stringify({
        levels: [{ id: 'classic-001' }, { id: 1 }, {}, { id: 'classic-002' }],
      }),
    );

    expect(parsed).toEqual(['classic-001', 'classic-002']);
  });

  it('throws on invalid level-pack payloads', () => {
    expect(() => parseImportedLevelIds('null')).toThrow('Level pack must be a JSON object.');
    expect(() => parseImportedLevelIds(JSON.stringify({}))).toThrow(
      'Level pack is missing levelIds or levels.',
    );
  });

  it('resolves known ids, dedupes recognized entries, and counts skipped ids', () => {
    const summary = resolveLevelPackImport(
      JSON.stringify({
        levelIds: ['classic-001', 'custom-001', 'classic-001', 'classic-002', 'custom-002'],
      }),
      knownLevelIds,
    );

    expect(summary).toEqual({
      validLevelIds: ['classic-001', 'classic-002'],
      importedCount: 5,
      skippedCount: 2,
    });
  });

  it('formats a notice only when unrecognized ids were skipped', () => {
    const noSkipNotice = formatLevelPackImportNotice({
      validLevelIds: ['classic-001'],
      importedCount: 1,
      skippedCount: 0,
    });
    expect(noSkipNotice).toBeNull();

    const notice = formatLevelPackImportNotice({
      validLevelIds: ['classic-001', 'classic-002'],
      importedCount: 4,
      skippedCount: 2,
    });
    expect(notice).toContain('Imported 2 levels.');
    expect(notice).toContain('2 unrecognized IDs were skipped');
  });
});
