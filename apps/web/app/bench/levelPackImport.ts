import { parseLevel } from '@corgiban/core';
import { builtinLevels, normalizeLevelDefinition, type LevelDefinition } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';

export type LevelPackImportSummary = {
  validLevelIds: string[];
  temporaryLevels: LevelDefinition[];
  importedCount: number;
  skippedCount: number;
  skippedMalformedBuiltinInlineCount: number;
};

export const LEVEL_PACK_TYPE = 'corgiban-level-pack';
export const LEVEL_PACK_VERSION = 1;

const builtinLevelsById = new Map(builtinLevels.map((level) => [level.id, level] as const));

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function countStrings(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return counts;
}

function createLevelDefinitionFingerprint(level: LevelDefinition): string {
  return JSON.stringify({
    id: level.id,
    name: level.name,
    rows: level.rows,
    knownSolution: level.knownSolution ?? null,
  });
}

function findUnsupportedLevelPackLevelIds(
  levels: readonly Pick<LevelDefinition, 'id'>[],
): string[] {
  const counts = new Map<string, number>();
  levels.forEach((level) => {
    counts.set(level.id, (counts.get(level.id) ?? 0) + 1);
  });

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([levelId]) => levelId)
    .sort();
}

export function assertSupportedLevelPackInlineLevels(levels: readonly LevelDefinition[]): void {
  const duplicateLevelIds = findUnsupportedLevelPackLevelIds(levels);
  if (duplicateLevelIds.length > 0) {
    throw new Error(
      `Level pack contains multiple inline variants for the same level id, which this format cannot preserve exactly: ${duplicateLevelIds.join(', ')}.`,
    );
  }

  const conflictingBuiltinIds = levels
    .filter((level) => {
      const builtinLevel = builtinLevelsById.get(level.id);
      return (
        builtinLevel !== undefined &&
        createLevelDefinitionFingerprint(builtinLevel) !== createLevelDefinitionFingerprint(level)
      );
    })
    .map((level) => level.id)
    .sort();

  if (conflictingBuiltinIds.length > 0) {
    throw new Error(
      `Level pack contains authored variants for built-in level ids, which this format cannot preserve exactly: ${uniqueStrings(conflictingBuiltinIds).join(', ')}.`,
    );
  }
}

export type ParsedImportedLevelPack = {
  importedLevelIds: string[];
  importedLevels: LevelDefinition[];
  malformedReferencedInlineLevelIds: string[];
};

function parseLevelDefinitionEntry(entry: Record<string, unknown>): LevelDefinition | null {
  if (!Array.isArray(entry.rows) || !entry.rows.every((row) => typeof row === 'string')) {
    return null;
  }
  if (typeof entry.id !== 'string') {
    return null;
  }

  try {
    const normalizedLevel = normalizeLevelDefinition({
      id: entry.id,
      name: typeof entry.name === 'string' ? entry.name : entry.id,
      rows: entry.rows,
      knownSolution:
        typeof entry.knownSolution === 'string' || entry.knownSolution === null
          ? (entry.knownSolution ?? null)
          : null,
    });
    parseLevel(normalizedLevel);
    return normalizedLevel;
  } catch {
    return null;
  }
}

function parseLevelEntries(entries: unknown): Record<string, unknown>[] {
  if (!Array.isArray(entries)) {
    throw new Error('Level pack is missing levelIds or levels.');
  }

  if (!entries.every((entry) => isObjectRecord(entry) && typeof entry.id === 'string')) {
    throw new Error('Level pack levels entries must include string ids.');
  }

  return entries as Record<string, unknown>[];
}

export function parseImportedLevelPack(jsonText: string): ParsedImportedLevelPack {
  const importBytes = new TextEncoder().encode(jsonText).byteLength;
  if (importBytes > MAX_IMPORT_BYTES) {
    const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
    const importMb = (importBytes / 1024 / 1024).toFixed(1);
    throw new Error(`Level pack is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
  }

  const parsed = JSON.parse(jsonText) as unknown;
  if (!isObjectRecord(parsed)) {
    throw new Error('Level pack must be a JSON object.');
  }

  if (parsed.type !== LEVEL_PACK_TYPE) {
    throw new Error('Unsupported level pack type.');
  }

  if (parsed.version !== LEVEL_PACK_VERSION) {
    throw new Error(`Unsupported level pack version. Expected ${LEVEL_PACK_VERSION}.`);
  }

  const levelIds = parsed.levelIds;
  const levels = parsed.levels;

  if (Array.isArray(levelIds)) {
    if (!levelIds.every((value) => typeof value === 'string')) {
      throw new Error('Level pack levelIds must be a string array.');
    }

    const importedLevels: LevelDefinition[] = [];
    const malformedReferencedInlineLevelIds: string[] = [];
    const referencedLevelIds = new Set(levelIds);

    if (Array.isArray(levels)) {
      for (const entry of parseLevelEntries(levels)) {
        const levelId = entry.id as string;
        if (!referencedLevelIds.has(levelId)) {
          continue;
        }

        const parsedLevel = parseLevelDefinitionEntry(entry);
        if (parsedLevel) {
          importedLevels.push(parsedLevel);
          continue;
        }

        malformedReferencedInlineLevelIds.push(levelId);
      }
    }

    assertSupportedLevelPackInlineLevels(importedLevels);

    return {
      importedLevelIds: levelIds,
      importedLevels,
      malformedReferencedInlineLevelIds,
    };
  }

  if (Array.isArray(levels)) {
    const levelEntries = parseLevelEntries(levels);
    const importedLevels: LevelDefinition[] = [];
    const malformedReferencedInlineLevelIds: string[] = [];
    const importedLevelIds = levelEntries.map((entry) => {
      const parsedLevel = parseLevelDefinitionEntry(entry);
      if (parsedLevel) {
        importedLevels.push(parsedLevel);
      } else if ('rows' in entry) {
        malformedReferencedInlineLevelIds.push(entry.id as string);
      }
      return entry.id as string;
    });

    assertSupportedLevelPackInlineLevels(importedLevels);

    return {
      importedLevelIds,
      importedLevels,
      malformedReferencedInlineLevelIds,
    };
  }

  throw new Error('Level pack is missing levelIds or levels.');
}

export function parseImportedLevelIds(jsonText: string): string[] {
  return parseImportedLevelPack(jsonText).importedLevelIds;
}

export function resolveLevelPackImport(
  jsonText: string,
  knownLevelIds: ReadonlySet<string>,
): LevelPackImportSummary {
  const { importedLevelIds, importedLevels, malformedReferencedInlineLevelIds } =
    parseImportedLevelPack(jsonText);
  const customLevelsById = new Map(importedLevels.map((level) => [level.id, level] as const));
  const malformedReferencedInlineCounts = countStrings(malformedReferencedInlineLevelIds);
  const recognizedLevelIds: string[] = [];
  const temporaryLevels: LevelDefinition[] = [];
  const seenLevelIds = new Set<string>();
  let skippedCount = 0;
  let skippedMalformedBuiltinInlineCount = 0;

  for (const levelId of importedLevelIds) {
    if (seenLevelIds.has(levelId)) {
      continue;
    }

    seenLevelIds.add(levelId);
    if (knownLevelIds.has(levelId)) {
      recognizedLevelIds.push(levelId);
      skippedMalformedBuiltinInlineCount += malformedReferencedInlineCounts.get(levelId) ?? 0;
      continue;
    }

    const customLevel = customLevelsById.get(levelId);
    if (customLevel) {
      temporaryLevels.push(customLevel);
      recognizedLevelIds.push(levelId);
      continue;
    }

    skippedCount += 1;
  }

  return {
    validLevelIds: uniqueStrings(recognizedLevelIds),
    temporaryLevels,
    importedCount: importedLevelIds.length,
    skippedCount,
    skippedMalformedBuiltinInlineCount,
  };
}

export function formatLevelPackImportNotice(summary: LevelPackImportSummary): string | null {
  if (
    summary.skippedCount <= 0 &&
    summary.temporaryLevels.length === 0 &&
    summary.skippedMalformedBuiltinInlineCount <= 0
  ) {
    return null;
  }

  const importedLabel = summary.validLevelIds.length === 1 ? 'level' : 'levels';
  const customLabel = summary.temporaryLevels.length === 1 ? 'custom level' : 'custom levels';
  const customVerb = summary.temporaryLevels.length === 1 ? 'is' : 'are';
  const skippedLabel = summary.skippedCount === 1 ? 'entry was' : 'entries were';
  const malformedLabel =
    summary.skippedMalformedBuiltinInlineCount === 1
      ? 'malformed referenced inline definition was'
      : 'malformed referenced inline definitions were';
  const parts = [`Imported ${summary.validLevelIds.length} ${importedLabel}.`];

  if (summary.temporaryLevels.length > 0) {
    parts.push(
      `${summary.temporaryLevels.length} temporary ${customLabel} ${customVerb} now available in Play, Lab, and Bench.`,
    );
  }

  if (summary.skippedCount > 0) {
    parts.push(
      `${summary.skippedCount} imported ${skippedLabel} skipped because no matching built-in id or custom level definition was available.`,
    );
  }

  if (summary.skippedMalformedBuiltinInlineCount > 0) {
    parts.push(
      `${summary.skippedMalformedBuiltinInlineCount} ${malformedLabel} skipped while reusing canonical built-in levels instead.`,
    );
  }

  return parts.join(' ');
}

export { findUnsupportedLevelPackLevelIds };
