import { parseLevel } from '@corgiban/core';
import { builtinLevels, normalizeLevelDefinition, type LevelDefinition } from '@corgiban/levels';

import { getBrowserSessionStorage } from '../browserStorage';
import { makeRunId } from '../runId';
import {
  resolveRequestedPlayableEntryFromEntries,
  type PlayableCatalogCompleteness,
  type RequestedPlayableEntryResolution,
  type ResolvePlayableEntryRequest,
} from './requestedPlayableEntry';
import { createPlayableExactLevelKey } from './playableIdentity';

export type SessionPlayableSource = {
  kind: 'session';
  originRef?: string;
  collectionRef?: string;
  collectionIndex?: number;
};

export type PlayableSource = { kind: 'builtin' } | SessionPlayableSource;

export type PlayableEntry = {
  ref: string;
  source: PlayableSource;
  level: LevelDefinition;
};

export type LegacyCatalogLevelEntry = LevelDefinition & {
  ref: string;
  source: 'builtin' | 'temporary';
  originRef?: string;
};

type StoredSessionPlayableEntry = {
  ref: string;
  originRef?: string;
  collectionRef?: string;
  collectionIndex?: number;
  level: LevelDefinition;
};

export type CatalogLevelEntry = LegacyCatalogLevelEntry;
export type CatalogLevelSource = CatalogLevelEntry['source'];

const PLAYABLE_LEVEL_STORAGE_KEY = 'corgiban:playable-level-catalog:v3';
const INCOMPATIBLE_PLAYABLE_LEVEL_STORAGE_KEYS = [
  'corgiban:playable-level-catalog:v2',
  'corgiban:temporary-level-catalog:v1',
] as const;
const builtinLevelsById = new Map(
  builtinLevels.map((level: LevelDefinition) => [level.id, level] as const),
);

let memorySessionEntries: StoredSessionPlayableEntry[] = [];
let storageMode: 'available' | 'memory-fallback' = 'available';
const catalogListeners = new Set<() => void>();

function cloneLevel(level: LevelDefinition): LevelDefinition {
  return {
    ...level,
    rows: [...level.rows],
  };
}

function cloneSessionPlayableSource(source: SessionPlayableSource): SessionPlayableSource {
  return {
    kind: 'session',
    ...(source.originRef ? { originRef: source.originRef } : {}),
    ...(source.collectionRef ? { collectionRef: source.collectionRef } : {}),
    ...(typeof source.collectionIndex === 'number'
      ? { collectionIndex: source.collectionIndex }
      : {}),
  };
}

function clonePlayableSource(source: PlayableSource): PlayableSource {
  if (source.kind === 'builtin') {
    return { kind: 'builtin' };
  }

  return cloneSessionPlayableSource(source);
}

function clonePlayableEntry(entry: PlayableEntry): PlayableEntry {
  return {
    ref: entry.ref,
    source: clonePlayableSource(entry.source),
    level: cloneLevel(entry.level),
  };
}

function cloneStoredSessionEntry(entry: StoredSessionPlayableEntry): StoredSessionPlayableEntry {
  return {
    ref: entry.ref,
    ...(entry.originRef ? { originRef: entry.originRef } : {}),
    ...(entry.collectionRef ? { collectionRef: entry.collectionRef } : {}),
    ...(typeof entry.collectionIndex === 'number'
      ? { collectionIndex: entry.collectionIndex }
      : {}),
    level: cloneLevel(entry.level),
  };
}

function cloneStoredSessionEntries(
  entries: StoredSessionPlayableEntry[],
): StoredSessionPlayableEntry[] {
  return entries.map(cloneStoredSessionEntry);
}

function notifyCatalogListeners(): void {
  catalogListeners.forEach((listener) => {
    listener();
  });
}

function sanitizeLevelDefinition(level: LevelDefinition): LevelDefinition {
  const normalized = normalizeLevelDefinition(cloneLevel(level));
  parseLevel(normalized);
  return normalized;
}

function sanitizeCollectionIndex(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Session playable collection indexes must be non-negative integers.`);
  }

  return value;
}

function sanitizeStoredSessionEntry(entry: {
  ref: string;
  originRef?: string;
  collectionRef?: string;
  collectionIndex?: number;
  level: LevelDefinition;
}): StoredSessionPlayableEntry {
  if (!entry.ref.startsWith('temp:')) {
    throw new Error(`Session playable refs must start with "temp:". Received "${entry.ref}".`);
  }

  return {
    ref: entry.ref,
    ...(entry.originRef ? { originRef: entry.originRef } : {}),
    ...(entry.collectionRef ? { collectionRef: entry.collectionRef } : {}),
    ...(typeof entry.collectionIndex === 'number'
      ? { collectionIndex: sanitizeCollectionIndex(entry.collectionIndex) }
      : {}),
    level: sanitizeLevelDefinition(entry.level),
  };
}

function buildSessionPlayableSource(entry: StoredSessionPlayableEntry): SessionPlayableSource {
  return {
    kind: 'session',
    ...(entry.originRef ? { originRef: entry.originRef } : {}),
    ...(entry.collectionRef ? { collectionRef: entry.collectionRef } : {}),
    ...(typeof entry.collectionIndex === 'number'
      ? { collectionIndex: entry.collectionIndex }
      : {}),
  };
}

function getSessionStorage(): Storage | null {
  return getBrowserSessionStorage();
}

function removePersistedSessionEntries(storage: Storage): void {
  try {
    storage.removeItem(PLAYABLE_LEVEL_STORAGE_KEY);
  } catch {
    storageMode = 'memory-fallback';
  }
}

function createPlayableEntryFromStoredSessionEntry(
  entry: StoredSessionPlayableEntry,
): PlayableEntry {
  return clonePlayableEntry({
    ref: entry.ref,
    source: buildSessionPlayableSource(entry),
    level: entry.level,
  });
}

function createBuiltinPlayableEntry(level: LevelDefinition): PlayableEntry {
  return {
    ref: toBuiltinLevelRef(level.id),
    source: { kind: 'builtin' },
    level: cloneLevel(level),
  };
}

function parseSerializedLevelDefinition(value: unknown): LevelDefinition | null {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as { id?: unknown }).id !== 'string' ||
    typeof (value as { name?: unknown }).name !== 'string' ||
    !Array.isArray((value as { rows?: unknown }).rows)
  ) {
    return null;
  }

  const rows = (value as { rows: unknown[] }).rows;
  if (!rows.every((row) => typeof row === 'string')) {
    return null;
  }

  try {
    return sanitizeLevelDefinition({
      id: (value as { id: string }).id,
      name: (value as { name: string }).name,
      rows,
      knownSolution:
        typeof (value as { knownSolution?: unknown }).knownSolution === 'string' ||
        (value as { knownSolution?: unknown }).knownSolution === null
          ? ((value as { knownSolution?: string | null }).knownSolution ?? null)
          : null,
    });
  } catch {
    return null;
  }
}

function deserializeStoredSessionEntries(
  value: string | null,
  storage: Storage,
): StoredSessionPlayableEntry[] {
  if (!value) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    removePersistedSessionEntries(storage);
    return cloneStoredSessionEntries(memorySessionEntries);
  }

  if (!Array.isArray(parsed)) {
    removePersistedSessionEntries(storage);
    return cloneStoredSessionEntries(memorySessionEntries);
  }

  const entries: StoredSessionPlayableEntry[] = [];
  parsed.forEach((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { ref?: unknown }).ref !== 'string'
    ) {
      return;
    }

    const level = parseSerializedLevelDefinition((entry as { level?: unknown }).level);
    if (!level) {
      return;
    }

    try {
      entries.push(
        sanitizeStoredSessionEntry({
          ref: (entry as { ref: string }).ref,
          originRef:
            typeof (entry as { originRef?: unknown }).originRef === 'string'
              ? (entry as { originRef?: string }).originRef
              : undefined,
          collectionRef:
            typeof (entry as { collectionRef?: unknown }).collectionRef === 'string'
              ? (entry as { collectionRef?: string }).collectionRef
              : undefined,
          collectionIndex:
            typeof (entry as { collectionIndex?: unknown }).collectionIndex === 'number'
              ? (entry as { collectionIndex?: number }).collectionIndex
              : undefined,
          level,
        }),
      );
    } catch {
      return;
    }
  });

  return entries;
}

function clearIncompatiblePersistedSessionEntries(storage: Storage): void {
  try {
    INCOMPATIBLE_PLAYABLE_LEVEL_STORAGE_KEYS.forEach((key) => {
      storage.removeItem(key);
    });
  } catch {
    storageMode = 'memory-fallback';
  }
}

function readSessionPlayableEntries(): StoredSessionPlayableEntry[] {
  if (storageMode === 'memory-fallback') {
    return cloneStoredSessionEntries(memorySessionEntries);
  }

  const storage = getSessionStorage();
  if (!storage) {
    return cloneStoredSessionEntries(memorySessionEntries);
  }

  let value: string | null;
  try {
    value = storage.getItem(PLAYABLE_LEVEL_STORAGE_KEY);
  } catch {
    storageMode = 'memory-fallback';
    return cloneStoredSessionEntries(memorySessionEntries);
  }

  const entries =
    value !== null
      ? deserializeStoredSessionEntries(value, storage)
      : (clearIncompatiblePersistedSessionEntries(storage), []);
  if (value !== null) {
    clearIncompatiblePersistedSessionEntries(storage);
  }
  memorySessionEntries = cloneStoredSessionEntries(entries);
  return entries;
}

function writeSessionPlayableEntries(entries: StoredSessionPlayableEntry[]): void {
  const clonedEntries = cloneStoredSessionEntries(entries);
  memorySessionEntries = clonedEntries;

  if (storageMode === 'memory-fallback') {
    return;
  }

  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    if (clonedEntries.length === 0) {
      storage.removeItem(PLAYABLE_LEVEL_STORAGE_KEY);
      clearIncompatiblePersistedSessionEntries(storage);
      return;
    }

    storage.setItem(
      PLAYABLE_LEVEL_STORAGE_KEY,
      JSON.stringify(
        clonedEntries.map((entry) => ({
          ref: entry.ref,
          ...(entry.originRef ? { originRef: entry.originRef } : {}),
          ...(entry.collectionRef ? { collectionRef: entry.collectionRef } : {}),
          ...(typeof entry.collectionIndex === 'number'
            ? { collectionIndex: entry.collectionIndex }
            : {}),
          level: cloneLevel(entry.level),
        })),
      ),
    );
    clearIncompatiblePersistedSessionEntries(storage);
  } catch {
    storageMode = 'memory-fallback';
  }
}

function upsertStoredSessionEntries(
  nextEntries: StoredSessionPlayableEntry[],
  nextEntry: StoredSessionPlayableEntry,
): void {
  const existingIndex = nextEntries.findIndex((entry) => entry.ref === nextEntry.ref);

  if (existingIndex >= 0) {
    nextEntries[existingIndex] = nextEntry;
    return;
  }

  nextEntries.push(nextEntry);
}

function createSessionPlayableCollectionRef(): string {
  return `collection:${makeRunId('playable-collection')}`;
}

export function toBuiltinLevelRef(levelId: string): string {
  return `builtin:${levelId}`;
}

export function isBuiltinLevelId(levelId: string): boolean {
  return builtinLevelsById.has(levelId);
}

export const createPlayableLevelFingerprint = createPlayableExactLevelKey;

export function listBuiltinPlayableEntries(): PlayableEntry[] {
  return builtinLevels.map((level: LevelDefinition) => createBuiltinPlayableEntry(level));
}

export function listPlayableEntries(): PlayableEntry[] {
  const sessionEntries = readSessionPlayableEntries().map((entry) =>
    createPlayableEntryFromStoredSessionEntry(entry),
  );

  return [...listBuiltinPlayableEntries(), ...sessionEntries];
}

export function getPlayableEntryByRef(levelRef: string | null | undefined): PlayableEntry | null {
  if (!levelRef) {
    return null;
  }

  if (levelRef.startsWith('builtin:')) {
    const builtinLevelId = levelRef.slice('builtin:'.length);
    const builtinLevel = builtinLevelsById.get(builtinLevelId);
    return builtinLevel ? createBuiltinPlayableEntry(builtinLevel) : null;
  }

  const sessionEntry = readSessionPlayableEntries().find((entry) => entry.ref === levelRef);
  return sessionEntry ? createPlayableEntryFromStoredSessionEntry(sessionEntry) : null;
}

export function resolveRequestedPlayableEntry(
  request: ResolvePlayableEntryRequest,
): RequestedPlayableEntryResolution<PlayableEntry> {
  return resolveRequestedPlayableEntryFromEntries(listPlayableEntries(), request, {
    completeness: 'client-session-aware' as PlayableCatalogCompleteness,
  });
}

export function resolvePlayableEntry(request: ResolvePlayableEntryRequest): PlayableEntry | null {
  const resolution = resolveRequestedPlayableEntry(request);
  return resolution.status === 'resolved' ? resolution.entry : null;
}

export function upsertSessionPlayableEntry(params: {
  ref?: string;
  originRef?: string;
  collectionRef?: string;
  collectionIndex?: number;
  level: LevelDefinition;
}): PlayableEntry {
  const nextRef = params.ref ?? `temp:${makeRunId('playable')}`;
  const nextEntry = sanitizeStoredSessionEntry({
    ref: nextRef,
    ...(params.originRef ? { originRef: params.originRef } : {}),
    ...(params.collectionRef ? { collectionRef: params.collectionRef } : {}),
    ...(typeof params.collectionIndex === 'number'
      ? { collectionIndex: params.collectionIndex }
      : {}),
    level: params.level,
  });
  const existingEntries = readSessionPlayableEntries();
  const nextEntries = [...existingEntries];

  upsertStoredSessionEntries(nextEntries, nextEntry);

  writeSessionPlayableEntries(nextEntries);
  notifyCatalogListeners();
  return createPlayableEntryFromStoredSessionEntry(nextEntry);
}

export function upsertSessionPlayableCollection(
  entries: Array<{
    ref?: string;
    originRef?: string;
    level: LevelDefinition;
  }>,
  options: {
    collectionRef?: string;
  } = {},
): PlayableEntry[] {
  if (entries.length === 0) {
    return [];
  }

  const collectionRef = options.collectionRef ?? createSessionPlayableCollectionRef();
  const existingEntries = readSessionPlayableEntries();
  const nextEntries = [...existingEntries];
  const collectionEntries = entries.map((entry, collectionIndex) => {
    const nextRef = entry.ref ?? `temp:${makeRunId('playable')}`;
    const nextEntry = sanitizeStoredSessionEntry({
      ref: nextRef,
      ...(entry.originRef ? { originRef: entry.originRef } : {}),
      collectionRef,
      collectionIndex,
      level: entry.level,
    });

    upsertStoredSessionEntries(nextEntries, nextEntry);
    return createPlayableEntryFromStoredSessionEntry(nextEntry);
  });

  writeSessionPlayableEntries(nextEntries);
  notifyCatalogListeners();
  return collectionEntries;
}

export function upsertSessionPlayableLevels(levels: LevelDefinition[]): PlayableEntry[] {
  if (levels.length === 0) {
    return [];
  }

  return levels.map((level) => upsertSessionPlayableEntry({ level }));
}

export function clearSessionPlayableEntries(): void {
  memorySessionEntries = [];

  const storage = getSessionStorage();
  if (!storage) {
    storageMode = typeof window === 'undefined' ? 'available' : 'memory-fallback';
    notifyCatalogListeners();
    return;
  }

  try {
    storage.removeItem(PLAYABLE_LEVEL_STORAGE_KEY);
    clearIncompatiblePersistedSessionEntries(storage);
    storageMode = 'available';
  } catch {
    storageMode = 'memory-fallback';
  }

  notifyCatalogListeners();
}

export function subscribePlayableCatalog(listener: () => void): () => void {
  catalogListeners.add(listener);
  return () => {
    catalogListeners.delete(listener);
  };
}

function toLegacyCatalogLevelEntry(entry: PlayableEntry): LegacyCatalogLevelEntry {
  return {
    ref: entry.ref,
    source: entry.source.kind === 'builtin' ? 'builtin' : 'temporary',
    ...(entry.source.kind === 'session' && entry.source.originRef
      ? { originRef: entry.source.originRef }
      : {}),
    ...cloneLevel(entry.level),
  };
}

export const listBuiltinPlayableLevels = (): LegacyCatalogLevelEntry[] =>
  listBuiltinPlayableEntries().map((entry) => toLegacyCatalogLevelEntry(entry));

export const listPlayableLevels = (): LegacyCatalogLevelEntry[] =>
  listPlayableEntries().map((entry) => toLegacyCatalogLevelEntry(entry));

export const getPlayableLevelById = (levelId: string): LegacyCatalogLevelEntry | null => {
  const entry = resolvePlayableEntry({ levelId });
  return entry ? toLegacyCatalogLevelEntry(entry) : null;
};

export const upsertTemporaryLevels = (levels: LevelDefinition[]): LegacyCatalogLevelEntry[] =>
  upsertSessionPlayableLevels(levels).map((entry) => toLegacyCatalogLevelEntry(entry));

export const clearTemporaryLevels = clearSessionPlayableEntries;
export const subscribeTemporaryLevelCatalog = subscribePlayableCatalog;

export type { PlayableCatalogCompleteness, ResolvePlayableEntryRequest };
export type { RequestedPlayableEntryResolution };
