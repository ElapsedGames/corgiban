import { hash } from '@corgiban/core';

export type PlayableIdentity = {
  levelId: string;
  levelRef?: string | null;
  exactLevelKey?: string | null;
};

export type ExactLevelKeyLevelLike = {
  id: string;
  name: string;
  rows: string[];
  knownSolution?: string | null;
};

type CanonicalPlayableExactLevelPayload = {
  id: string;
  name: string;
  rows: string[];
  knownSolution: string | null;
};

function buildCanonicalPlayableExactLevelPayload(
  level: ExactLevelKeyLevelLike,
): CanonicalPlayableExactLevelPayload {
  return {
    id: level.id,
    name: level.name,
    rows: level.rows,
    knownSolution: level.knownSolution ?? null,
  };
}

export function createLegacyPlayableExactLevelKey(level: ExactLevelKeyLevelLike): string {
  return JSON.stringify(buildCanonicalPlayableExactLevelPayload(level));
}

function createCompactPlayableExactLevelHash(serializedPayload: string): string {
  const primaryHash = hash(serializedPayload).toString(36);
  const secondaryHash = hash(`playable-exact:${serializedPayload}`).toString(36);
  return `${primaryHash}-${secondaryHash}`;
}

export function createPlayableExactLevelKey(level: ExactLevelKeyLevelLike): string {
  return `playable:v2:${createCompactPlayableExactLevelHash(
    createLegacyPlayableExactLevelKey(level),
  )}`;
}

export function isLegacyPlayableExactLevelKey(exactLevelKey: string): boolean {
  return exactLevelKey.startsWith('{');
}

export function matchesPlayableExactLevelKey(
  level: ExactLevelKeyLevelLike,
  exactLevelKey: string,
): boolean {
  if (createPlayableExactLevelKey(level) === exactLevelKey) {
    return true;
  }

  return (
    isLegacyPlayableExactLevelKey(exactLevelKey) &&
    createLegacyPlayableExactLevelKey(level) === exactLevelKey
  );
}
