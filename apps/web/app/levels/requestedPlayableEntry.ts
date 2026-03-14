import { matchesPlayableExactLevelKey } from './playableIdentity';

export type PlayableCatalogCompleteness = 'server-builtin-only' | 'client-session-aware';

export type ResolvePlayableEntryRequest = {
  levelRef?: string | null;
  levelId?: string | null;
  exactLevelKey?: string | null;
};

export type RequestedPlayableEntryLike = {
  ref: string;
  source: { kind: 'builtin' | 'session' };
  level: {
    id: string;
    name: string;
    rows: string[];
    knownSolution?: string | null;
  };
};

export type RequestedPlayableEntryResolution<
  TEntry extends RequestedPlayableEntryLike = RequestedPlayableEntryLike,
> =
  | { status: 'none' }
  | { status: 'resolved'; entry: TEntry }
  | {
      status: 'pendingClientCatalog';
      requestedRef?: string;
      requestedLevelId?: string;
      requestedExactLevelKey?: string;
      fallbackLevelId?: string;
    }
  | { status: 'missingExactRef'; requestedRef: string; fallbackLevelId?: string }
  | {
      status: 'missingExactKey';
      requestedExactLevelKey: string;
      requestedRef?: string;
      requestedLevelId?: string;
      fallbackLevelId?: string;
    }
  | { status: 'missingLevelId'; requestedLevelId: string };

export type ResolveRequestedPlayableEntryOptions = {
  completeness?: PlayableCatalogCompleteness;
};

function resolveLegacyPlayableEntry<TEntry extends RequestedPlayableEntryLike>(
  playableEntries: readonly TEntry[],
  levelId: string,
): TEntry | null {
  const builtinEntry = playableEntries.find(
    (entry) => entry.source.kind === 'builtin' && entry.level.id === levelId,
  );
  if (builtinEntry) {
    return builtinEntry;
  }

  const matchingSessionEntries = playableEntries.filter(
    (entry) => entry.source.kind === 'session' && entry.level.id === levelId,
  );
  return matchingSessionEntries.length === 1 ? matchingSessionEntries[0] : null;
}

function inferFallbackLevelId(request: ResolvePlayableEntryRequest): string | undefined {
  if (request.levelId) {
    return request.levelId;
  }

  if (request.levelRef?.startsWith('builtin:')) {
    return request.levelRef.slice('builtin:'.length);
  }

  return undefined;
}

export function hasRequestedPlayableEntry(request: ResolvePlayableEntryRequest): boolean {
  return Boolean(request.levelRef || request.levelId || request.exactLevelKey);
}

function hasBuiltinLevelId<TEntry extends RequestedPlayableEntryLike>(
  playableEntries: readonly TEntry[],
  levelId: string,
): boolean {
  return playableEntries.some(
    (entry) => entry.source.kind === 'builtin' && entry.level.id === levelId,
  );
}

function resolveExactLevelKeyEntry<TEntry extends RequestedPlayableEntryLike>(
  playableEntries: readonly TEntry[],
  exactLevelKey: string,
): TEntry | null {
  const matches = playableEntries.filter((entry) =>
    matchesPlayableExactLevelKey(entry.level, exactLevelKey),
  );
  if (matches.length === 0) {
    return null;
  }

  const builtinMatch = matches.find((entry) => entry.source.kind === 'builtin');
  if (builtinMatch) {
    return builtinMatch;
  }

  return [...matches].sort((left, right) => left.ref.localeCompare(right.ref))[0] ?? null;
}

function shouldWaitForClientCatalog<TEntry extends RequestedPlayableEntryLike>(
  playableEntries: readonly TEntry[],
  request: ResolvePlayableEntryRequest,
  completeness: PlayableCatalogCompleteness,
): boolean {
  if (completeness !== 'server-builtin-only') {
    return false;
  }

  if (request.levelRef?.startsWith('temp:')) {
    return true;
  }

  if (request.exactLevelKey) {
    return !request.levelRef?.startsWith('builtin:');
  }

  if (request.levelId) {
    return !hasBuiltinLevelId(playableEntries, request.levelId);
  }

  return false;
}

export function resolveRequestedPlayableEntryFromEntries<TEntry extends RequestedPlayableEntryLike>(
  playableEntries: readonly TEntry[],
  request: ResolvePlayableEntryRequest,
  options: ResolveRequestedPlayableEntryOptions = {},
): RequestedPlayableEntryResolution<TEntry> {
  const completeness = options.completeness ?? 'client-session-aware';
  const fallbackLevelId = inferFallbackLevelId(request);

  if (request.levelRef) {
    const exactEntry = playableEntries.find((entry) => entry.ref === request.levelRef);
    if (exactEntry) {
      if (
        request.exactLevelKey &&
        !matchesPlayableExactLevelKey(exactEntry.level, request.exactLevelKey)
      ) {
        return {
          status: 'missingExactKey',
          requestedExactLevelKey: request.exactLevelKey,
          requestedRef: request.levelRef,
          ...(request.levelId ? { requestedLevelId: request.levelId } : {}),
          ...(fallbackLevelId ? { fallbackLevelId } : {}),
        };
      }

      return { status: 'resolved', entry: exactEntry };
    }

    if (shouldWaitForClientCatalog(playableEntries, request, completeness)) {
      return {
        status: 'pendingClientCatalog',
        requestedRef: request.levelRef,
        ...(request.levelId ? { requestedLevelId: request.levelId } : {}),
        ...(request.exactLevelKey ? { requestedExactLevelKey: request.exactLevelKey } : {}),
        ...(fallbackLevelId ? { fallbackLevelId } : {}),
      };
    }

    return fallbackLevelId
      ? {
          status: 'missingExactRef',
          requestedRef: request.levelRef,
          fallbackLevelId,
        }
      : {
          status: 'missingExactRef',
          requestedRef: request.levelRef,
        };
  }

  if (request.exactLevelKey) {
    const exactLevelKeyEntry = resolveExactLevelKeyEntry(playableEntries, request.exactLevelKey);
    if (exactLevelKeyEntry) {
      return { status: 'resolved', entry: exactLevelKeyEntry };
    }

    if (shouldWaitForClientCatalog(playableEntries, request, completeness)) {
      return {
        status: 'pendingClientCatalog',
        ...(request.levelId ? { requestedLevelId: request.levelId } : {}),
        requestedExactLevelKey: request.exactLevelKey,
        ...(fallbackLevelId ? { fallbackLevelId } : {}),
      };
    }

    return {
      status: 'missingExactKey',
      requestedExactLevelKey: request.exactLevelKey,
      ...(request.levelId ? { requestedLevelId: request.levelId } : {}),
      ...(fallbackLevelId ? { fallbackLevelId } : {}),
    };
  }

  if (request.levelId) {
    const legacyEntry = resolveLegacyPlayableEntry(playableEntries, request.levelId);
    if (legacyEntry) {
      return { status: 'resolved', entry: legacyEntry };
    }

    if (shouldWaitForClientCatalog(playableEntries, request, completeness)) {
      return {
        status: 'pendingClientCatalog',
        requestedLevelId: request.levelId,
      };
    }

    return {
      status: 'missingLevelId',
      requestedLevelId: request.levelId,
    };
  }

  return { status: 'none' };
}
