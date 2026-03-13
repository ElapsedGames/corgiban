import { builtinLevels } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { describe, expect, it } from 'vitest';

import {
  formatLevelPackImportNotice,
  findUnsupportedLevelPackLevelIds,
  LEVEL_PACK_TYPE,
  LEVEL_PACK_VERSION,
  parseImportedLevelPack,
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

  it('captures custom level definitions when rows are provided', () => {
    const parsed = parseImportedLevelPack(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levels: [
          {
            id: 'custom-001',
            name: 'Custom One',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
          },
        ],
      }),
    );

    expect(parsed.importedLevelIds).toEqual(['custom-001']);
    expect(parsed.importedLevels).toEqual([
      {
        id: 'custom-001',
        name: 'Custom One',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
        knownSolution: null,
      },
    ]);
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

  it('prefers top-level levelIds for id ordering when both supported shapes are present', () => {
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

  it('preserves inline custom definitions from levels when both fields exist', () => {
    const parsed = parseImportedLevelPack(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levelIds: ['corgiban-test-18', 'custom-001'],
        levels: [
          { id: 'corgiban-test-18' },
          {
            id: 'custom-001',
            name: 'Custom One',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
          },
        ],
      }),
    );

    expect(parsed.importedLevelIds).toEqual(['corgiban-test-18', 'custom-001']);
    expect(parsed.importedLevels).toEqual([
      {
        id: 'custom-001',
        name: 'Custom One',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
        knownSolution: null,
      },
    ]);
  });

  it('ignores malformed unused inline definitions when levelIds is authoritative', () => {
    const summary = resolveLevelPackImport(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levelIds: ['corgiban-test-18'],
        levels: [
          {
            id: 'unused-bad-level',
            rows: ['WWWWW', 'WPXWW', 'WWWWW'],
          },
        ],
      }),
      knownLevelIds,
    );

    expect(summary).toEqual({
      validLevelIds: ['corgiban-test-18'],
      temporaryLevels: [],
      importedCount: 1,
      skippedCount: 0,
      skippedMalformedBuiltinInlineCount: 0,
    });
  });

  it('ignores malformed built-in inline definitions when a recognized id is imported', () => {
    const summary = resolveLevelPackImport(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levelIds: ['corgiban-test-18'],
        levels: [
          {
            id: 'corgiban-test-18',
            rows: ['WWWWW', 'WPXWW', 'WWWWW'],
          },
        ],
      }),
      knownLevelIds,
    );

    expect(summary).toEqual({
      validLevelIds: ['corgiban-test-18'],
      temporaryLevels: [],
      importedCount: 1,
      skippedCount: 0,
      skippedMalformedBuiltinInlineCount: 1,
    });
  });

  it('formats a notice when malformed referenced built-in inline definitions are skipped', () => {
    const notice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18'],
      temporaryLevels: [],
      importedCount: 1,
      skippedCount: 0,
      skippedMalformedBuiltinInlineCount: 1,
    });

    expect(notice).toBe(
      'Imported 1 level. 1 malformed referenced inline definition was skipped while reusing canonical built-in levels instead.',
    );
  });

  it('skips malformed inline custom definitions instead of failing the entire import', () => {
    const summary = resolveLevelPackImport(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levels: [
          {
            id: 'custom-001',
            rows: ['WWWWW', 'WPXWW', 'WWWWW'],
          },
        ],
      }),
      knownLevelIds,
    );

    expect(summary).toEqual({
      validLevelIds: [],
      temporaryLevels: [],
      importedCount: 1,
      skippedCount: 1,
      skippedMalformedBuiltinInlineCount: 0,
    });
  });

  it('round-trips an app-generated dual-field payload through resolveLevelPackImport', () => {
    const builtinLevel = builtinLevels.find((level) => level.id === 'corgiban-test-18');
    expect(builtinLevel).toBeTruthy();

    const payload = JSON.stringify({
      type: LEVEL_PACK_TYPE,
      version: LEVEL_PACK_VERSION,
      levelIds: ['corgiban-test-18', 'custom-roundtrip'],
      levels: [
        builtinLevel,
        {
          id: 'custom-roundtrip',
          name: 'Round Trip',
          rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
        },
      ],
    });

    const summary = resolveLevelPackImport(payload, knownLevelIds);

    expect(summary.validLevelIds).toEqual(['corgiban-test-18', 'custom-roundtrip']);
    expect(summary.temporaryLevels.map((l) => l.id)).toEqual(['custom-roundtrip']);
    expect(summary.skippedCount).toBe(0);
    expect(summary.skippedMalformedBuiltinInlineCount).toBe(0);
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

  it('rejects multiple inline variants that share the same canonical level id', () => {
    expect(() =>
      parseImportedLevelPack(
        JSON.stringify({
          type: LEVEL_PACK_TYPE,
          version: LEVEL_PACK_VERSION,
          levels: [
            {
              id: 'custom-duplicate',
              name: 'Custom One',
              rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
            },
            {
              id: 'custom-duplicate',
              name: 'Custom Two',
              rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
            },
          ],
        }),
      ),
    ).toThrow('multiple inline variants');
  });

  it('rejects authored variants that reuse a built-in level id', () => {
    expect(() =>
      parseImportedLevelPack(
        JSON.stringify({
          type: LEVEL_PACK_TYPE,
          version: LEVEL_PACK_VERSION,
          levels: [
            {
              id: 'corgiban-test-18',
              name: 'Edited Builtin Variant',
              rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
            },
          ],
        }),
      ),
    ).toThrow('authored variants for built-in level ids');
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
      temporaryLevels: [],
      importedCount: 5,
      skippedCount: 2,
      skippedMalformedBuiltinInlineCount: 0,
    });
  });

  it('keeps custom level definitions when the pack includes them', () => {
    const summary = resolveLevelPackImport(
      JSON.stringify({
        type: LEVEL_PACK_TYPE,
        version: LEVEL_PACK_VERSION,
        levels: [
          { id: 'corgiban-test-18' },
          {
            id: 'custom-001',
            name: 'Custom One',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
          },
          {
            id: 'custom-002',
            name: 'Custom Two',
            rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
          },
        ],
      }),
      knownLevelIds,
    );

    expect(summary.validLevelIds).toEqual(['corgiban-test-18', 'custom-001', 'custom-002']);
    expect(summary.temporaryLevels.map((level) => level.id)).toEqual(['custom-001', 'custom-002']);
    expect(summary.skippedCount).toBe(0);
    expect(summary.skippedMalformedBuiltinInlineCount).toBe(0);
  });

  it('formats a notice only when custom levels or skipped ids need an explanation', () => {
    const noSkipNotice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18'],
      temporaryLevels: [],
      importedCount: 1,
      skippedCount: 0,
      skippedMalformedBuiltinInlineCount: 0,
    });
    expect(noSkipNotice).toBeNull();

    const notice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18', 'corgiban-test-22'],
      temporaryLevels: [],
      importedCount: 4,
      skippedCount: 2,
      skippedMalformedBuiltinInlineCount: 0,
    });
    expect(notice).toContain('Imported 2 levels.');
    expect(notice).toContain('2 imported entries were skipped');
  });

  it('formats notice grammar for temporary custom levels and singular skipped entries', () => {
    const notice = formatLevelPackImportNotice({
      validLevelIds: ['corgiban-test-18'],
      temporaryLevels: [
        {
          id: 'custom-001',
          name: 'Custom One',
          rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
        },
      ],
      importedCount: 2,
      skippedCount: 1,
      skippedMalformedBuiltinInlineCount: 0,
    });

    expect(notice).toBe(
      'Imported 1 level. 1 temporary custom level is now available in Play, Lab, and Bench. 1 imported entry was skipped because no matching built-in id or custom level definition was available.',
    );
  });

  it('finds unsupported duplicate level ids for export validation', () => {
    expect(
      findUnsupportedLevelPackLevelIds([{ id: 'corgiban-test-18' }, { id: 'corgiban-test-18' }]),
    ).toEqual(['corgiban-test-18']);
  });
});
