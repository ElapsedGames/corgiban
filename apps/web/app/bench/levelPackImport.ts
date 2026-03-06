import { MAX_IMPORT_BYTES } from '@corgiban/shared';

export type LevelPackImportSummary = {
  validLevelIds: string[];
  importedCount: number;
  skippedCount: number;
};

export const LEVEL_PACK_TYPE = 'corgiban-level-pack';
export const LEVEL_PACK_VERSION = 1;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parseImportedLevelIds(jsonText: string): string[] {
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
  if (Array.isArray(levelIds)) {
    if (!levelIds.every((value) => typeof value === 'string')) {
      throw new Error('Level pack levelIds must be a string array.');
    }

    return levelIds;
  }

  const levels = parsed.levels;
  if (Array.isArray(levels)) {
    if (!levels.every((entry) => isObjectRecord(entry) && typeof entry.id === 'string')) {
      throw new Error('Level pack levels entries must include string ids.');
    }

    return levels.map((entry) => entry.id);
  }

  throw new Error('Level pack is missing levelIds or levels.');
}

export function resolveLevelPackImport(
  jsonText: string,
  knownLevelIds: ReadonlySet<string>,
): LevelPackImportSummary {
  const importedLevelIds = parseImportedLevelIds(jsonText);
  const recognizedLevelIds = importedLevelIds.filter((levelId) => knownLevelIds.has(levelId));

  return {
    validLevelIds: uniqueStrings(recognizedLevelIds),
    importedCount: importedLevelIds.length,
    skippedCount: importedLevelIds.length - recognizedLevelIds.length,
  };
}

export function formatLevelPackImportNotice(summary: LevelPackImportSummary): string | null {
  if (summary.skippedCount <= 0) {
    return null;
  }

  const importedLabel = summary.validLevelIds.length === 1 ? 'level' : 'levels';
  const skippedLabel = summary.skippedCount === 1 ? 'ID was' : 'IDs were';

  return `Imported ${summary.validLevelIds.length} ${importedLabel}. ${summary.skippedCount} unrecognized ${skippedLabel} skipped (custom levels are not yet supported).`;
}
