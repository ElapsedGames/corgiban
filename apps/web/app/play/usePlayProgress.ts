import { useCallback, useEffect, useState } from 'react';

import { builtinLevels } from '@corgiban/levels';
import type { LevelDefinition } from '@corgiban/levels';

import { getBrowserLocalStorage } from '../browserStorage';
import {
  createLegacyPlayableExactLevelKey,
  createPlayableExactLevelKey,
} from '../levels/playableIdentity';

export const PLAY_PROGRESS_STORAGE_KEY = 'corgiban-play-progress';
const PLAY_PROGRESS_VERSION = 2;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type StoredPlayLevelLike = {
  levelRef: string;
  levelId: string;
  exactLevelKey?: string;
};

export type StoredPlayLevel = {
  levelRef: string;
  levelId: string;
};

export type PlayProgressRecord = {
  version: 2;
  lastPlayedLevel: StoredPlayLevel | null;
  completedLevelIds: string[];
  updatedAtIso: string;
};

export type UsePlayProgressResult = {
  isPlayProgressReady: boolean;
  playProgress: PlayProgressRecord | null;
  markCompletedLevel: (levelId: string) => void;
  rememberLastPlayedLevel: (level: StoredPlayLevel) => void;
};

const builtinLevelIdsByExactKey = new Map<string, string>(
  builtinLevels.flatMap((level: LevelDefinition) => [
    [createPlayableExactLevelKey(level), level.id] as const,
    [createLegacyPlayableExactLevelKey(level), level.id] as const,
  ]),
);

function isStoredPlayLevelLike(value: unknown): value is StoredPlayLevelLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    exactLevelKey?: unknown;
    levelId?: unknown;
    levelRef?: unknown;
  };
  if (typeof candidate.levelRef !== 'string' || typeof candidate.levelId !== 'string') {
    return false;
  }

  return candidate.exactLevelKey === undefined || typeof candidate.exactLevelKey === 'string';
}

function toStoredPlayLevel(level: StoredPlayLevelLike): StoredPlayLevel {
  return {
    levelRef: level.levelRef,
    levelId: level.levelId,
  };
}

function createEmptyPlayProgress(): PlayProgressRecord {
  return {
    version: PLAY_PROGRESS_VERSION,
    lastPlayedLevel: null,
    completedLevelIds: [],
    updatedAtIso: new Date(0).toISOString(),
  };
}

function normalizeCompletedLevelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextLevelIds = value.filter((entry): entry is string => typeof entry === 'string');
  return [...new Set(nextLevelIds)];
}

function normalizeLegacyCompletedExactLevelKeys(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextLevelIds = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((exactLevelKey) => builtinLevelIdsByExactKey.get(exactLevelKey) ?? null)
    .filter((levelId): levelId is string => typeof levelId === 'string');
  return [...new Set(nextLevelIds)];
}

function sanitizePlayProgressRecord(value: unknown): PlayProgressRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    completedExactLevelKeys?: unknown;
    completedLevelIds?: unknown;
    lastPlayedLevel?: unknown;
    updatedAtIso?: unknown;
    version?: unknown;
  };
  if (candidate.version !== 1 && candidate.version !== PLAY_PROGRESS_VERSION) {
    return null;
  }

  const lastPlayedLevel =
    candidate.lastPlayedLevel === null
      ? null
      : isStoredPlayLevelLike(candidate.lastPlayedLevel)
        ? toStoredPlayLevel(candidate.lastPlayedLevel)
        : null;
  const updatedAtIso =
    typeof candidate.updatedAtIso === 'string'
      ? candidate.updatedAtIso
      : createEmptyPlayProgress().updatedAtIso;
  const completedLevelIds =
    candidate.version === PLAY_PROGRESS_VERSION
      ? normalizeCompletedLevelIds(candidate.completedLevelIds)
      : normalizeLegacyCompletedExactLevelKeys(candidate.completedExactLevelKeys);

  return {
    version: PLAY_PROGRESS_VERSION,
    lastPlayedLevel,
    completedLevelIds,
    updatedAtIso,
  };
}

export function readStoredPlayProgress(
  storage: StorageLike | null | undefined,
): PlayProgressRecord | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(PLAY_PROGRESS_STORAGE_KEY);
    if (!value) {
      return null;
    }

    return sanitizePlayProgressRecord(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export function persistPlayProgress(
  playProgress: PlayProgressRecord,
  storage: StorageLike | null | undefined,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(PLAY_PROGRESS_STORAGE_KEY, JSON.stringify(playProgress));
  } catch {
    // Ignore persistence failures so Play remains usable in restricted environments.
  }
}

function areStoredPlayLevelsEqual(
  left: StoredPlayLevel | null | undefined,
  right: StoredPlayLevel | null | undefined,
): boolean {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.levelRef === right.levelRef && left.levelId === right.levelId;
}

export function usePlayProgress(): UsePlayProgressResult {
  const [playProgress, setPlayProgress] = useState<PlayProgressRecord | null>(null);
  const [isPlayProgressReady, setIsPlayProgressReady] = useState(false);

  useEffect(() => {
    setPlayProgress(readStoredPlayProgress(getBrowserLocalStorage()) ?? createEmptyPlayProgress());
    setIsPlayProgressReady(true);
  }, []);

  const updatePlayProgress = useCallback(
    (updater: (current: PlayProgressRecord) => PlayProgressRecord) => {
      setPlayProgress((current: PlayProgressRecord | null) => {
        const currentValue = current ?? createEmptyPlayProgress();
        const nextValue = updater(currentValue);
        persistPlayProgress(nextValue, getBrowserLocalStorage());
        return nextValue;
      });
      setIsPlayProgressReady(true);
    },
    [],
  );

  const rememberLastPlayedLevel = useCallback(
    (level: StoredPlayLevel) => {
      updatePlayProgress((current: PlayProgressRecord) => {
        if (areStoredPlayLevelsEqual(current.lastPlayedLevel, level)) {
          return current;
        }

        return {
          ...current,
          lastPlayedLevel: level,
          updatedAtIso: new Date().toISOString(),
        };
      });
    },
    [updatePlayProgress],
  );

  const markCompletedLevel = useCallback(
    (levelId: string) => {
      updatePlayProgress((current: PlayProgressRecord) => {
        if (current.completedLevelIds.includes(levelId)) {
          return current;
        }

        return {
          ...current,
          completedLevelIds: [...current.completedLevelIds, levelId],
          updatedAtIso: new Date().toISOString(),
        };
      });
    },
    [updatePlayProgress],
  );

  return {
    isPlayProgressReady,
    playProgress,
    markCompletedLevel,
    rememberLastPlayedLevel,
  };
}
