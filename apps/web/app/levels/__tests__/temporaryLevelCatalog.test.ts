// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { builtinLevels } from '@corgiban/levels';

import {
  clearSessionPlayableEntries,
  clearTemporaryLevels,
  getPlayableEntryByRef,
  getPlayableLevelById,
  isBuiltinLevelId,
  listBuiltinPlayableEntries,
  listPlayableEntries,
  listBuiltinPlayableLevels,
  resolvePlayableEntry,
  subscribeTemporaryLevelCatalog,
  toBuiltinLevelRef,
  upsertSessionPlayableCollection,
  upsertSessionPlayableEntry,
  upsertTemporaryLevels,
} from '../temporaryLevelCatalog';

describe('temporaryLevelCatalog', () => {
  const storageKey = 'corgiban:playable-level-catalog:v3';
  const previousStorageKey = 'corgiban:playable-level-catalog:v2';
  const legacyStorageKey = 'corgiban:temporary-level-catalog:v1';

  afterEach(() => {
    vi.restoreAllMocks();
    clearSessionPlayableEntries();
    clearTemporaryLevels();
    window.sessionStorage.clear();
  });

  it('lists builtin levels before temporary imported levels', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-001',
        name: 'Custom Play Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    const entries = listPlayableEntries();
    expect(entries[0]?.level.id).toBe(builtinLevels[0]?.id);
    expect(entries.at(-1)?.level.id).toBe('custom-play-001');
    expect(entries.at(-1)?.source.kind).toBe('session');
  });

  it('exposes a builtin-only snapshot and notifies subscribers when temporary levels change', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTemporaryLevelCatalog(listener);

    expect(listBuiltinPlayableLevels().every((level) => level.source === 'builtin')).toBe(true);
    expect(listBuiltinPlayableLevels().some((level) => level.id === builtinLevels[0]?.id)).toBe(
      true,
    );

    upsertTemporaryLevels([
      {
        id: 'custom-play-subscriber',
        name: 'Subscriber Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
    ]);
    clearTemporaryLevels();
    unsubscribe();
    upsertTemporaryLevels([
      {
        id: 'custom-play-post-unsubscribe',
        name: 'No Notification Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      },
    ]);

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('keeps builtin and session entries with the same canonical level id distinct by playable ref', () => {
    const builtinLevel = builtinLevels[0];
    expect(builtinLevel).toBeTruthy();

    const sessionEntry = upsertSessionPlayableEntry({
      originRef: toBuiltinLevelRef(builtinLevel?.id ?? 'builtin-fallback'),
      level: {
        id: builtinLevel?.id ?? 'builtin-fallback',
        name: 'Edited Builtin Variant',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
      },
    });

    const matchingEntries = listPlayableEntries().filter(
      (entry) => entry.level.id === (builtinLevel?.id ?? 'builtin-fallback'),
    );

    expect(matchingEntries).toHaveLength(2);
    expect(
      matchingEntries.some(
        (entry) =>
          entry.source.kind === 'builtin' && entry.ref === toBuiltinLevelRef(entry.level.id),
      ),
    ).toBe(true);
    expect(matchingEntries.some((entry) => entry.ref === sessionEntry.ref)).toBe(true);
    expect(getPlayableEntryByRef(sessionEntry.ref)).toEqual(
      expect.objectContaining({
        ref: sessionEntry.ref,
        source: {
          kind: 'session',
          originRef: toBuiltinLevelRef(builtinLevel?.id ?? 'builtin-fallback'),
        },
        level: expect.objectContaining({
          id: builtinLevel?.id ?? 'builtin-fallback',
          name: 'Edited Builtin Variant',
          knownSolution: null,
        }),
      }),
    );
    expect(resolvePlayableEntry({ levelId: builtinLevel?.id ?? 'builtin-fallback' })).toMatchObject(
      {
        ref: toBuiltinLevelRef(builtinLevel?.id ?? 'builtin-fallback'),
        source: { kind: 'builtin' },
      },
    );
  });

  it('preserves imported collection metadata and order for session playable batches', () => {
    const builtinLevelA = builtinLevels[0];
    const builtinLevelB = builtinLevels[1];
    expect(builtinLevelA).toBeTruthy();
    expect(builtinLevelB).toBeTruthy();

    const entries = upsertSessionPlayableCollection([
      {
        originRef: toBuiltinLevelRef(builtinLevelB?.id ?? 'builtin-b'),
        level: builtinLevelB ?? {
          id: 'builtin-b',
          name: 'Builtin B',
          rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        },
      },
      {
        originRef: toBuiltinLevelRef(builtinLevelA?.id ?? 'builtin-a'),
        level: builtinLevelA ?? {
          id: 'builtin-a',
          name: 'Builtin A',
          rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        },
      },
    ]);

    expect(entries).toHaveLength(2);
    expect(entries[0]?.source).toMatchObject({
      kind: 'session',
      originRef: toBuiltinLevelRef(builtinLevelB?.id ?? 'builtin-b'),
      collectionIndex: 0,
    });
    expect(entries[1]?.source).toMatchObject({
      kind: 'session',
      originRef: toBuiltinLevelRef(builtinLevelA?.id ?? 'builtin-a'),
      collectionIndex: 1,
    });
    expect(entries[0]?.source.kind === 'session' ? entries[0].source.collectionRef : null).toBe(
      entries[1]?.source.kind === 'session' ? entries[1].source.collectionRef : null,
    );
    expect(
      listPlayableEntries()
        .filter(
          (entry) =>
            entry.source.kind === 'session' &&
            entry.source.collectionRef ===
              (entries[0]?.source.kind === 'session' ? entries[0].source.collectionRef : undefined),
        )
        .map((entry) => entry.ref),
    ).toEqual(entries.map((entry) => entry.ref));
    expect(JSON.parse(window.sessionStorage.getItem(storageKey) ?? '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ref: entries[0]?.ref,
          collectionIndex: 0,
        }),
        expect.objectContaining({
          ref: entries[1]?.ref,
          collectionIndex: 1,
        }),
      ]),
    );
  });

  it('round-trips session collection metadata from serialized storage payloads', () => {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          ref: 'temp:serialized-collection-0',
          originRef: toBuiltinLevelRef(builtinLevels[0]?.id ?? 'builtin-fallback'),
          collectionRef: 'collection:serialized-pack',
          collectionIndex: 0,
          level: {
            id: builtinLevels[0]?.id ?? 'builtin-fallback',
            name: builtinLevels[0]?.name ?? 'Builtin Fallback',
            rows: builtinLevels[0]?.rows ?? ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
            knownSolution: builtinLevels[0]?.knownSolution ?? null,
          },
        },
      ]),
    );

    const serializedEntry = getPlayableEntryByRef('temp:serialized-collection-0');

    expect(serializedEntry).toEqual(
      expect.objectContaining({
        ref: 'temp:serialized-collection-0',
        source: {
          kind: 'session',
          originRef: toBuiltinLevelRef(builtinLevels[0]?.id ?? 'builtin-fallback'),
          collectionRef: 'collection:serialized-pack',
          collectionIndex: 0,
        },
      }),
    );
  });

  it('prefers exact levelRef resolution over legacy levelId fallback', () => {
    const builtinLevel = builtinLevels[0];
    expect(builtinLevel).toBeTruthy();

    const sessionEntry = upsertSessionPlayableEntry({
      level: {
        id: builtinLevel?.id ?? 'builtin-fallback',
        name: 'Exact Ref Variant',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
      },
    });

    expect(
      resolvePlayableEntry({
        levelRef: sessionEntry.ref,
        levelId: builtinLevel?.id ?? 'builtin-fallback',
      }),
    ).toEqual(
      expect.objectContaining({
        ref: sessionEntry.ref,
        source: { kind: 'session' },
        level: expect.objectContaining({
          id: builtinLevel?.id ?? 'builtin-fallback',
          name: 'Exact Ref Variant',
          knownSolution: null,
        }),
      }),
    );
  });

  it('does not guess when legacy levelId fallback matches multiple session entries', () => {
    upsertSessionPlayableEntry({
      level: {
        id: 'ambiguous-session-level',
        name: 'First Ambiguous Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });
    upsertSessionPlayableEntry({
      level: {
        id: 'ambiguous-session-level',
        name: 'Second Ambiguous Level',
        rows: ['WWWWWW', 'WPBTEW', 'WEEEWW', 'WWWWWW'],
      },
    });

    expect(resolvePlayableEntry({ levelId: 'ambiguous-session-level' })).toBeNull();
    expect(getPlayableLevelById('ambiguous-session-level')).toBeNull();
  });

  it('keeps the SSR snapshot builtin-only even when session entries exist', () => {
    upsertSessionPlayableEntry({
      level: {
        id: 'ssr-session-level',
        name: 'SSR Session Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    });

    expect(listBuiltinPlayableEntries().every((entry) => entry.source.kind === 'builtin')).toBe(
      true,
    );
    expect(
      listBuiltinPlayableEntries().some((entry) => entry.level.id === 'ssr-session-level'),
    ).toBe(false);
  });

  it('returns temporary levels by id after they are registered', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-002',
        name: 'Custom Solve Level',
        rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
      },
    ]);

    expect(getPlayableLevelById('custom-play-002')).toMatchObject({
      id: 'custom-play-002',
      name: 'Custom Solve Level',
      source: 'temporary',
    });
  });

  it('does not allow temporary imports to replace builtin levels', () => {
    const builtinLevel = builtinLevels[0];
    expect(builtinLevel).toBeTruthy();

    upsertTemporaryLevels([
      {
        id: builtinLevel?.id ?? 'builtin-fallback',
        name: 'Shadow Builtin',
        rows: ['P'],
      },
    ]);

    expect(getPlayableLevelById(builtinLevel?.id ?? 'builtin-fallback')).toMatchObject({
      id: builtinLevel?.id ?? 'builtin-fallback',
      name: builtinLevel?.name,
      source: 'builtin',
    });
  });

  it('recognizes builtin ids, returns null for empty ids, and no-ops empty upserts', () => {
    expect(isBuiltinLevelId(builtinLevels[0]?.id ?? 'missing-builtin')).toBe(true);
    expect(getPlayableLevelById('')).toBeNull();
    expect(upsertTemporaryLevels([])).toEqual([]);
  });

  it('reads the in-memory catalog when window is unavailable', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-no-window',
        name: 'No Window Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    vi.stubGlobal('window', undefined);
    try {
      expect(getPlayableLevelById('custom-play-no-window')).toMatchObject({
        id: 'custom-play-no-window',
        source: 'temporary',
      });
      expect(
        listPlayableEntries().some((level) => level.level.id === 'custom-play-no-window'),
      ).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('ignores malformed serialized temporary levels and keeps valid entries', () => {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify([
        null,
        {
          ref: 'temp:custom-play-003',
          level: {
            id: 'custom-play-003',
            name: 'Custom Stored Level',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
            knownSolution: 123,
          },
        },
        {
          ref: 'temp:custom-play-invalid',
          level: {
            id: 'custom-play-invalid',
            name: 'Invalid Stored Level',
            rows: ['WWWWW', 'WPXWW', 'WWWWW'],
          },
        },
        {
          ref: 'temp:custom-play-bad-rows',
          level: {
            id: 'custom-play-bad-rows',
            name: 'Bad Rows',
            rows: ['WWWWW', 1, 'WWWWW'],
          },
        },
      ]),
    );

    const levels = listPlayableEntries();
    const storedLevel = getPlayableLevelById('custom-play-003');

    expect(levels.some((level) => level.level.id === 'custom-play-003')).toBe(true);
    expect(storedLevel).toMatchObject({
      id: 'custom-play-003',
      name: 'Custom Stored Level',
      source: 'temporary',
      knownSolution: null,
    });
    expect(getPlayableLevelById('custom-play-invalid')).toBeNull();
    expect(getPlayableLevelById('custom-play-bad-rows')).toBeNull();
  });

  it('treats malformed top-level catalog JSON as empty and clears the corrupted entry', () => {
    window.sessionStorage.setItem(storageKey, '{not-json');

    expect(() => listPlayableEntries()).not.toThrow();
    expect(window.sessionStorage.getItem(storageKey)).toBeNull();
    expect(listPlayableEntries()[0]?.level.id).toBe(builtinLevels[0]?.id);
  });

  it('treats non-array catalog payloads as empty even when removing the corrupted entry fails', () => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({ invalid: true }));
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError');
    });

    expect(() => listPlayableEntries()).not.toThrow();
    expect(listPlayableEntries()[0]?.level.id).toBe(builtinLevels[0]?.id);
    expect(window.sessionStorage.getItem(storageKey)).toBe(JSON.stringify({ invalid: true }));
  });

  it('preserves explicit null knownSolution values from the current serialized session catalog', () => {
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify([
        {
          ref: 'temp:custom-play-null-known-solution',
          level: {
            id: 'custom-play-null-known-solution',
            name: 'Null Known Solution',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
            knownSolution: null,
          },
        },
      ]),
    );

    expect(getPlayableLevelById('custom-play-null-known-solution')).toMatchObject({
      id: 'custom-play-null-known-solution',
      knownSolution: null,
      source: 'temporary',
    });
  });

  it('invalidates incompatible v2 session catalog data instead of migrating it', () => {
    window.sessionStorage.setItem(
      previousStorageKey,
      JSON.stringify([
        {
          ref: 'temp:legacy-session-entry',
          level: {
            id: 'legacy-session-entry',
            name: 'Legacy Session Entry',
            rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
          },
        },
      ]),
    );

    expect(getPlayableLevelById('legacy-session-entry')).toBeNull();
    expect(window.sessionStorage.getItem(previousStorageKey)).toBeNull();
  });

  it('invalidates incompatible legacy temp catalog data instead of migrating it', () => {
    window.sessionStorage.setItem(
      legacyStorageKey,
      JSON.stringify([
        {
          id: 'legacy-temp-entry',
          name: 'Legacy Temp Entry',
          rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
        },
      ]),
    );

    expect(getPlayableLevelById('legacy-temp-entry')).toBeNull();
    expect(window.sessionStorage.getItem(legacyStorageKey)).toBeNull();
  });

  it('falls back to memory when sessionStorage writes throw and keeps temporary levels available', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError');
    });

    upsertTemporaryLevels([
      {
        id: 'custom-play-memory-fallback',
        name: 'Memory Fallback Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    const readsBeforeFallback = getItemSpy.mock.calls.length;
    const levels = listPlayableEntries();

    expect(levels.some((level) => level.level.id === 'custom-play-memory-fallback')).toBe(true);
    expect(getPlayableLevelById('custom-play-memory-fallback')).toMatchObject({
      id: 'custom-play-memory-fallback',
      source: 'temporary',
    });
    expect(getItemSpy).toHaveBeenCalledTimes(readsBeforeFallback);
  });

  it('falls back to memory when sessionStorage reads throw after a successful import', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-read-fallback',
        name: 'Read Fallback Level',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(
      listPlayableEntries().some((level) => level.level.id === 'custom-play-read-fallback'),
    ).toBe(true);
    expect(getPlayableLevelById('custom-play-read-fallback')).toMatchObject({
      id: 'custom-play-read-fallback',
      source: 'temporary',
    });
  });

  it('keeps temporary upserts available when sessionStorage access is unavailable', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    upsertTemporaryLevels([
      {
        id: 'custom-play-no-storage-upsert',
        name: 'No Storage Upsert',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    expect(getPlayableLevelById('custom-play-no-storage-upsert')).toMatchObject({
      id: 'custom-play-no-storage-upsert',
      source: 'temporary',
    });
    expect(
      listPlayableEntries().some((level) => level.level.id === 'custom-play-no-storage-upsert'),
    ).toBe(true);
  });

  it('merges additional temporary levels after storage fallback without touching sessionStorage again', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError');
    });

    upsertTemporaryLevels([
      {
        id: 'custom-play-memory-seed',
        name: 'Memory Seed',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    const readsAfterFallback = getItemSpy.mock.calls.length;
    upsertTemporaryLevels([
      {
        id: 'custom-play-memory-merge',
        name: 'Memory Merge',
        rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
      },
    ]);

    const temporaryIds = listPlayableEntries()
      .filter((level) => level.source.kind === 'session')
      .map((level) => level.level.id);

    expect(temporaryIds).toContain('custom-play-memory-seed');
    expect(temporaryIds).toContain('custom-play-memory-merge');
    expect(getItemSpy).toHaveBeenCalledTimes(readsAfterFallback);
  });

  it('notifies subscribers when clearing temporary levels without sessionStorage access', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-clear-no-storage',
        name: 'Clear Without Storage',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    const listener = vi.fn();
    const unsubscribe = subscribeTemporaryLevelCatalog(listener);
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    clearTemporaryLevels();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPlayableLevelById('custom-play-clear-no-storage')).toBeNull();
    expect(
      listPlayableEntries().some((level) => level.level.id === 'custom-play-clear-no-storage'),
    ).toBe(false);

    unsubscribe();
  });

  it('notifies subscribers when clearing temporary levels without a window object', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-clear-no-window',
        name: 'Clear Without Window',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    const listener = vi.fn();
    const unsubscribe = subscribeTemporaryLevelCatalog(listener);
    vi.stubGlobal('window', undefined);

    try {
      clearTemporaryLevels();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(getPlayableLevelById('custom-play-clear-no-window')).toBeNull();
      expect(
        listPlayableEntries().some((level) => level.level.id === 'custom-play-clear-no-window'),
      ).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      unsubscribe();
    }
  });

  it('notifies subscribers when clearing temporary levels falls back after removeItem failure', () => {
    upsertTemporaryLevels([
      {
        id: 'custom-play-clear-remove-failure',
        name: 'Clear Remove Failure',
        rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
      },
    ]);

    const listener = vi.fn();
    const unsubscribe = subscribeTemporaryLevelCatalog(listener);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'QuotaExceededError');
    });

    clearTemporaryLevels();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getPlayableLevelById('custom-play-clear-remove-failure')).toBeNull();
    expect(
      listPlayableEntries().some((level) => level.level.id === 'custom-play-clear-remove-failure'),
    ).toBe(false);

    unsubscribe();
  });
});
