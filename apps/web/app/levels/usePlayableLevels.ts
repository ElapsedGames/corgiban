import { useMemo, useSyncExternalStore } from 'react';

import {
  listBuiltinPlayableEntries,
  listPlayableEntries,
  subscribePlayableCatalog,
  type PlayableEntry,
  type PlayableCatalogCompleteness,
  type RequestedPlayableEntryResolution,
  type ResolvePlayableEntryRequest,
} from './temporaryLevelCatalog';
import { resolveRequestedPlayableEntryFromEntries } from './requestedPlayableEntry';

export type PlayableCatalogSnapshot = {
  entries: PlayableEntry[];
  completeness: PlayableCatalogCompleteness;
};

let cachedBuiltinSnapshot: PlayableCatalogSnapshot | null = null;
let cachedPlayableEntriesSnapshot: PlayableCatalogSnapshot | null = null;

function arePlayableEntrySnapshotsEqual(
  left: PlayableEntry[] | null,
  right: PlayableEntry[],
): boolean {
  if (!left || left.length !== right.length) {
    return false;
  }

  return left.every((entry, index) => {
    const candidate = right[index];
    if (!candidate) {
      return false;
    }

    const leftOriginRef = entry.source.kind === 'session' ? entry.source.originRef : undefined;
    const rightOriginRef =
      candidate.source.kind === 'session' ? candidate.source.originRef : undefined;
    const leftCollectionRef =
      entry.source.kind === 'session' ? entry.source.collectionRef : undefined;
    const rightCollectionRef =
      candidate.source.kind === 'session' ? candidate.source.collectionRef : undefined;
    const leftCollectionIndex =
      entry.source.kind === 'session' ? entry.source.collectionIndex : undefined;
    const rightCollectionIndex =
      candidate.source.kind === 'session' ? candidate.source.collectionIndex : undefined;

    if (
      entry.ref !== candidate.ref ||
      entry.source.kind !== candidate.source.kind ||
      leftOriginRef !== rightOriginRef ||
      leftCollectionRef !== rightCollectionRef ||
      leftCollectionIndex !== rightCollectionIndex ||
      entry.level.id !== candidate.level.id ||
      entry.level.name !== candidate.level.name ||
      entry.level.knownSolution !== candidate.level.knownSolution ||
      entry.level.rows.length !== candidate.level.rows.length
    ) {
      return false;
    }

    return entry.level.rows.every((row, rowIndex) => row === candidate.level.rows[rowIndex]);
  });
}

function getBuiltinPlayableEntriesSnapshot(): PlayableCatalogSnapshot {
  const nextSnapshot = listBuiltinPlayableEntries();
  if (
    cachedBuiltinSnapshot &&
    arePlayableEntrySnapshotsEqual(cachedBuiltinSnapshot.entries, nextSnapshot)
  ) {
    return cachedBuiltinSnapshot;
  }

  cachedBuiltinSnapshot = {
    entries: nextSnapshot,
    completeness: 'server-builtin-only',
  };
  return cachedBuiltinSnapshot;
}

function getPlayableEntriesSnapshot(): PlayableCatalogSnapshot {
  const nextSnapshot = listPlayableEntries();
  if (
    cachedPlayableEntriesSnapshot &&
    arePlayableEntrySnapshotsEqual(cachedPlayableEntriesSnapshot.entries, nextSnapshot)
  ) {
    return cachedPlayableEntriesSnapshot;
  }

  cachedPlayableEntriesSnapshot = {
    entries: nextSnapshot,
    completeness: 'client-session-aware',
  };
  return cachedPlayableEntriesSnapshot;
}

export function usePlayableCatalogSnapshot(): PlayableCatalogSnapshot {
  return useSyncExternalStore(
    subscribePlayableCatalog,
    getPlayableEntriesSnapshot,
    getBuiltinPlayableEntriesSnapshot,
  );
}

export function usePlayableLevels(): PlayableEntry[] {
  return usePlayableCatalogSnapshot().entries;
}

export function useResolvedPlayableEntry(
  request: ResolvePlayableEntryRequest,
): PlayableEntry | null {
  const resolution = useRequestedPlayableEntryResolution(request);
  return resolution.status === 'resolved' ? resolution.entry : null;
}

export function useRequestedPlayableEntryResolution(
  request: ResolvePlayableEntryRequest,
): RequestedPlayableEntryResolution<PlayableEntry> {
  const playableCatalog = usePlayableCatalogSnapshot();
  const { levelRef, levelId, exactLevelKey } = request;

  return useMemo(() => {
    return resolveRequestedPlayableEntryFromEntries(
      playableCatalog.entries,
      { levelRef, levelId, exactLevelKey },
      { completeness: playableCatalog.completeness },
    );
  }, [exactLevelKey, levelId, levelRef, playableCatalog]);
}

export function usePlayableLevelById(levelId: string | null | undefined): PlayableEntry | null {
  return useResolvedPlayableEntry({ levelId });
}
