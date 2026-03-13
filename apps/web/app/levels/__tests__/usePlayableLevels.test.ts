import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockPlayableEntry = {
  ref: string;
  source:
    | { kind: 'builtin' }
    | {
        kind: 'session';
        originRef?: string;
        collectionRef?: string;
        collectionIndex?: number;
      };
  level: {
    id: string;
    name: string;
    rows: string[];
    knownSolution?: string | null;
  };
};

const hookState = vi.hoisted(() => ({
  builtinLevels: [] as MockPlayableEntry[],
  playableLevels: [] as MockPlayableEntry[],
  useServerSnapshot: false,
}));

vi.mock('react', () => ({
  useMemo: (factory: () => unknown) => factory(),
  useSyncExternalStore: (
    _subscribe: (listener: () => void) => () => void,
    getSnapshot: () => unknown,
    getServerSnapshot?: () => unknown,
  ) => (hookState.useServerSnapshot ? getServerSnapshot?.() : getSnapshot()),
}));

vi.mock('../temporaryLevelCatalog', () => ({
  listBuiltinPlayableEntries: () => hookState.builtinLevels,
  listPlayableEntries: () => hookState.playableLevels,
  subscribePlayableCatalog: () => () => undefined,
}));

async function loadHooks() {
  vi.resetModules();
  return import('../usePlayableLevels');
}

describe('usePlayableLevels', () => {
  beforeEach(() => {
    hookState.builtinLevels = [];
    hookState.playableLevels = [];
    hookState.useServerSnapshot = false;
  });

  it('reuses cached playable snapshots only when entries remain structurally identical', async () => {
    const levelA: MockPlayableEntry = {
      ref: 'builtin:builtin-a',
      source: { kind: 'builtin' },
      level: {
        id: 'builtin-a',
        name: 'Builtin A',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };
    const levelB: MockPlayableEntry = {
      ref: 'temp:temp-b',
      source: { kind: 'session' },
      level: {
        id: 'temp-b',
        name: 'Temp B',
        rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        knownSolution: 'R',
      },
    };

    const { usePlayableLevels } = await loadHooks();

    hookState.playableLevels = [levelA, levelB];
    const firstSnapshot = usePlayableLevels();

    hookState.playableLevels = [
      { ...levelA, level: { ...levelA.level, rows: [...levelA.level.rows] } },
      { ...levelB, level: { ...levelB.level, rows: [...levelB.level.rows] } },
    ];
    const equalSnapshot = usePlayableLevels();
    expect(equalSnapshot).toBe(firstSnapshot);
  });

  it('replaces the cached snapshot when a candidate entry is missing', async () => {
    const levelA: MockPlayableEntry = {
      ref: 'builtin:builtin-a',
      source: { kind: 'builtin' },
      level: {
        id: 'builtin-a',
        name: 'Builtin A',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };
    const levelB: MockPlayableEntry = {
      ref: 'temp:temp-b',
      source: { kind: 'session' },
      level: {
        id: 'temp-b',
        name: 'Temp B',
        rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        knownSolution: 'R',
      },
    };

    const { usePlayableLevels } = await loadHooks();

    hookState.playableLevels = [levelA, levelB];
    const firstSnapshot = usePlayableLevels();

    hookState.playableLevels = [{ ...levelA }, undefined as unknown as MockPlayableEntry];
    const missingCandidateSnapshot = usePlayableLevels();
    expect(missingCandidateSnapshot).not.toBe(firstSnapshot);
  });

  it('replaces the cached snapshot when session collection metadata changes', async () => {
    const levelA: MockPlayableEntry = {
      ref: 'temp:temp-a',
      source: {
        kind: 'session',
        collectionRef: 'collection:alpha',
        collectionIndex: 0,
      },
      level: {
        id: 'temp-a',
        name: 'Temp A',
        rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        knownSolution: null,
      },
    };

    const { usePlayableLevels } = await loadHooks();

    hookState.playableLevels = [levelA];
    const firstSnapshot = usePlayableLevels();

    hookState.playableLevels = [
      {
        ...levelA,
        source: {
          kind: 'session',
          collectionRef: 'collection:beta',
          collectionIndex: 0,
        },
      },
    ];
    const changedSnapshot = usePlayableLevels();
    expect(changedSnapshot).not.toBe(firstSnapshot);
  });

  it('replaces the cached snapshot when entry metadata changes', async () => {
    const levelA: MockPlayableEntry = {
      ref: 'builtin:builtin-a',
      source: { kind: 'builtin' },
      level: {
        id: 'builtin-a',
        name: 'Builtin A',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };
    const levelB: MockPlayableEntry = {
      ref: 'temp:temp-b',
      source: { kind: 'session' },
      level: {
        id: 'temp-b',
        name: 'Temp B',
        rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        knownSolution: 'R',
      },
    };

    const { usePlayableLevels } = await loadHooks();

    hookState.playableLevels = [levelA, levelB];
    const firstSnapshot = usePlayableLevels();

    hookState.playableLevels = [
      { ...levelA },
      { ...levelB, level: { ...levelB.level, name: 'Temp B Updated' } },
    ];
    const changedSnapshot = usePlayableLevels();
    expect(changedSnapshot).not.toBe(firstSnapshot);
  });

  it('uses the builtin server snapshot during SSR-style reads', async () => {
    const builtinLevel: MockPlayableEntry = {
      ref: 'builtin:builtin-ssr',
      source: { kind: 'builtin' },
      level: {
        id: 'builtin-ssr',
        name: 'Builtin SSR',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };

    const { usePlayableLevels } = await loadHooks();

    hookState.builtinLevels = [builtinLevel];
    hookState.playableLevels = [];
    hookState.useServerSnapshot = true;

    expect(usePlayableLevels()).toEqual([builtinLevel]);
  });
});

describe('usePlayableLevelById', () => {
  beforeEach(() => {
    hookState.builtinLevels = [];
    hookState.playableLevels = [];
    hookState.useServerSnapshot = false;
  });

  it('returns null for empty ids and resolves existing playable levels by id', async () => {
    const level: MockPlayableEntry = {
      ref: 'temp:temporary-level',
      source: { kind: 'session' },
      level: {
        id: 'temporary-level',
        name: 'Temporary Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };

    const { usePlayableLevelById } = await loadHooks();

    hookState.playableLevels = [level];

    expect(usePlayableLevelById(null)).toBeNull();
    expect(usePlayableLevelById(undefined)).toBeNull();
    expect(usePlayableLevelById('missing-level')).toBeNull();
    expect(usePlayableLevelById('temporary-level')).toEqual(level);
  });
});

describe('useRequestedPlayableEntryResolution', () => {
  beforeEach(() => {
    hookState.builtinLevels = [];
    hookState.playableLevels = [];
    hookState.useServerSnapshot = false;
  });

  it('reports missing exact refs without falling back through the canonical level id', async () => {
    const sessionLevel: MockPlayableEntry = {
      ref: 'temp:session-level',
      source: { kind: 'session' },
      level: {
        id: 'shared-level-id',
        name: 'Session Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };
    const builtinLevel: MockPlayableEntry = {
      ref: 'builtin:shared-level-id',
      source: { kind: 'builtin' },
      level: {
        id: 'shared-level-id',
        name: 'Builtin Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };

    const { useRequestedPlayableEntryResolution } = await loadHooks();

    hookState.playableLevels = [builtinLevel, sessionLevel];

    expect(
      useRequestedPlayableEntryResolution({
        levelRef: 'temp:missing-session-level',
        levelId: 'shared-level-id',
      }),
    ).toEqual({
      status: 'missingExactRef',
      requestedRef: 'temp:missing-session-level',
      fallbackLevelId: 'shared-level-id',
    });
  });

  it('reports pending client-catalog resolution for session refs during SSR snapshots', async () => {
    const builtinLevel: MockPlayableEntry = {
      ref: 'builtin:shared-level-id',
      source: { kind: 'builtin' },
      level: {
        id: 'shared-level-id',
        name: 'Builtin Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };

    const { useRequestedPlayableEntryResolution } = await loadHooks();

    hookState.builtinLevels = [builtinLevel];
    hookState.playableLevels = [builtinLevel];
    hookState.useServerSnapshot = true;

    expect(
      useRequestedPlayableEntryResolution({
        levelRef: 'temp:missing-session-level',
        levelId: 'shared-level-id',
        exactLevelKey: JSON.stringify({
          id: 'shared-level-id',
          name: 'Session Level',
          rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
          knownSolution: null,
        }),
      }),
    ).toEqual({
      status: 'pendingClientCatalog',
      requestedRef: 'temp:missing-session-level',
      requestedLevelId: 'shared-level-id',
      requestedExactLevelKey: JSON.stringify({
        id: 'shared-level-id',
        name: 'Session Level',
        rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
        knownSolution: null,
      }),
      fallbackLevelId: 'shared-level-id',
    });
  });

  it('treats exact built-in variants as pending during SSR when only the client catalog can verify them', async () => {
    const builtinLevel: MockPlayableEntry = {
      ref: 'builtin:shared-level-id',
      source: { kind: 'builtin' },
      level: {
        id: 'shared-level-id',
        name: 'Builtin Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };
    const requestedExactLevelKey = JSON.stringify({
      id: 'shared-level-id',
      name: 'Edited Session Level',
      rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
      knownSolution: null,
    });

    const { useRequestedPlayableEntryResolution } = await loadHooks();

    hookState.builtinLevels = [builtinLevel];
    hookState.playableLevels = [builtinLevel];
    hookState.useServerSnapshot = true;

    expect(
      useRequestedPlayableEntryResolution({
        levelId: 'shared-level-id',
        exactLevelKey: requestedExactLevelKey,
      }),
    ).toEqual({
      status: 'pendingClientCatalog',
      requestedLevelId: 'shared-level-id',
      requestedExactLevelKey,
      fallbackLevelId: 'shared-level-id',
    });
  });

  it('fails closed when an exact level key does not match after the client catalog loads', async () => {
    const builtinLevel: MockPlayableEntry = {
      ref: 'builtin:shared-level-id',
      source: { kind: 'builtin' },
      level: {
        id: 'shared-level-id',
        name: 'Builtin Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: null,
      },
    };
    const requestedExactLevelKey = JSON.stringify({
      id: 'shared-level-id',
      name: 'Edited Session Level',
      rows: ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
      knownSolution: null,
    });

    const { useRequestedPlayableEntryResolution } = await loadHooks();

    hookState.playableLevels = [builtinLevel];

    expect(
      useRequestedPlayableEntryResolution({
        levelId: 'shared-level-id',
        exactLevelKey: requestedExactLevelKey,
      }),
    ).toEqual({
      status: 'missingExactKey',
      requestedExactLevelKey,
      requestedLevelId: 'shared-level-id',
      fallbackLevelId: 'shared-level-id',
    });
  });

  it('reports missing legacy ids explicitly', async () => {
    const { useRequestedPlayableEntryResolution } = await loadHooks();

    expect(useRequestedPlayableEntryResolution({ levelId: 'missing-level' })).toEqual({
      status: 'missingLevelId',
      requestedLevelId: 'missing-level',
    });
  });
});
