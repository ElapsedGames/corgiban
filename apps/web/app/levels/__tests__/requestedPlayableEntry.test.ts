import { describe, expect, it } from 'vitest';

import {
  createLegacyPlayableExactLevelKey,
  createPlayableExactLevelKey,
} from '../playableIdentity';
import {
  hasRequestedPlayableEntry,
  resolveRequestedPlayableEntryFromEntries,
  type RequestedPlayableEntryLike,
} from '../requestedPlayableEntry';

function createEntry(
  ref: string,
  levelId: string,
  name: string,
  rows: string[],
  source: RequestedPlayableEntryLike['source'],
): RequestedPlayableEntryLike {
  return {
    ref,
    source,
    level: {
      id: levelId,
      name,
      rows,
      knownSolution: null,
    },
  };
}

describe('requestedPlayableEntry', () => {
  const builtinEntry = createEntry(
    'builtin:shared-level',
    'shared-level',
    'Builtin Level',
    ['WWW', 'WPW', 'WWW'],
    { kind: 'builtin' },
  );
  const sessionEntryA = createEntry(
    'temp:session-a',
    'shared-level',
    'Session Variant A',
    ['WWWW', 'WPBW', 'WTEW', 'WWWW'],
    { kind: 'session' },
  );
  const sessionEntryB = createEntry(
    'temp:session-b',
    'shared-level',
    'Session Variant B',
    ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
    { kind: 'session' },
  );

  it('detects whether a request carries any playable identity', () => {
    expect(hasRequestedPlayableEntry({})).toBe(false);
    expect(hasRequestedPlayableEntry({ exactLevelKey: 'exact-key' })).toBe(true);
  });

  it('prefers an exact levelRef match and rejects mismatched exact level keys', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries([builtinEntry, sessionEntryA], {
        levelRef: sessionEntryA.ref,
        levelId: builtinEntry.level.id,
      }),
    ).toEqual({
      status: 'resolved',
      entry: sessionEntryA,
    });

    expect(
      resolveRequestedPlayableEntryFromEntries([builtinEntry, sessionEntryA], {
        levelRef: sessionEntryA.ref,
        levelId: builtinEntry.level.id,
        exactLevelKey: createLegacyPlayableExactLevelKey(builtinEntry.level),
      }),
    ).toEqual({
      status: 'missingExactKey',
      requestedExactLevelKey: createLegacyPlayableExactLevelKey(builtinEntry.level),
      requestedRef: sessionEntryA.ref,
      requestedLevelId: builtinEntry.level.id,
      fallbackLevelId: builtinEntry.level.id,
    });
  });

  it('infers builtin fallback ids from missing builtin refs', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries([builtinEntry], {
        levelRef: 'builtin:missing-level',
      }),
    ).toEqual({
      status: 'missingExactRef',
      requestedRef: 'builtin:missing-level',
      fallbackLevelId: 'missing-level',
    });
  });

  it('waits for the client catalog when a server snapshot cannot prove a session handoff yet', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries(
        [builtinEntry],
        {
          levelRef: 'temp:missing-session',
          levelId: builtinEntry.level.id,
          exactLevelKey: createLegacyPlayableExactLevelKey(sessionEntryA.level),
        },
        { completeness: 'server-builtin-only' },
      ),
    ).toEqual({
      status: 'pendingClientCatalog',
      requestedRef: 'temp:missing-session',
      requestedLevelId: builtinEntry.level.id,
      requestedExactLevelKey: createLegacyPlayableExactLevelKey(sessionEntryA.level),
      fallbackLevelId: builtinEntry.level.id,
    });
  });

  it('fails closed for non-session exact refs when the server snapshot has no reason to wait', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries(
        [builtinEntry],
        {
          levelRef: 'external:missing-level',
        },
        { completeness: 'server-builtin-only' },
      ),
    ).toEqual({
      status: 'missingExactRef',
      requestedRef: 'external:missing-level',
    });
  });

  it('prefers builtin exact-key matches and otherwise uses the lexicographically first session ref', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries([builtinEntry, sessionEntryA], {
        exactLevelKey: createLegacyPlayableExactLevelKey(builtinEntry.level),
      }),
    ).toEqual({
      status: 'resolved',
      entry: builtinEntry,
    });

    expect(
      resolveRequestedPlayableEntryFromEntries([sessionEntryB, sessionEntryA], {
        exactLevelKey: createLegacyPlayableExactLevelKey(sessionEntryA.level),
      }),
    ).toEqual({
      status: 'resolved',
      entry: sessionEntryA,
    });
  });

  it('resolves compact exact keys for newly generated handoff metadata', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries([builtinEntry, sessionEntryA], {
        exactLevelKey: createPlayableExactLevelKey(sessionEntryA.level),
      }),
    ).toEqual({
      status: 'resolved',
      entry: sessionEntryA,
    });
  });

  it('resolves legacy level ids only when there is a builtin or a single session match', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries([builtinEntry, sessionEntryA], {
        levelId: builtinEntry.level.id,
      }),
    ).toEqual({
      status: 'resolved',
      entry: builtinEntry,
    });

    expect(
      resolveRequestedPlayableEntryFromEntries([sessionEntryA], {
        levelId: sessionEntryA.level.id,
      }),
    ).toEqual({
      status: 'resolved',
      entry: sessionEntryA,
    });

    expect(
      resolveRequestedPlayableEntryFromEntries([sessionEntryA, sessionEntryB], {
        levelId: sessionEntryA.level.id,
      }),
    ).toEqual({
      status: 'missingLevelId',
      requestedLevelId: sessionEntryA.level.id,
    });
  });

  it('reports missing exact keys when the client catalog finishes and no exact match exists', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries(
        [builtinEntry],
        {
          levelId: builtinEntry.level.id,
          exactLevelKey: createLegacyPlayableExactLevelKey(sessionEntryA.level),
        },
        { completeness: 'client-session-aware' },
      ),
    ).toEqual({
      status: 'missingExactKey',
      requestedExactLevelKey: createLegacyPlayableExactLevelKey(sessionEntryA.level),
      requestedLevelId: builtinEntry.level.id,
      fallbackLevelId: builtinEntry.level.id,
    });
  });

  it('waits for a missing legacy level id only when the server snapshot lacks builtin evidence', () => {
    expect(
      resolveRequestedPlayableEntryFromEntries(
        [],
        {
          levelId: 'missing-level',
        },
        { completeness: 'server-builtin-only' },
      ),
    ).toEqual({
      status: 'pendingClientCatalog',
      requestedLevelId: 'missing-level',
    });
  });
});
