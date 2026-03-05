export type LevelPackImportSummary = {
  validLevelIds: string[];
  importedCount: number;
  skippedCount: number;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function parseImportedLevelIds(jsonText: string): string[] {
  const parsed = JSON.parse(jsonText) as unknown;
  if (!isObjectRecord(parsed)) {
    throw new Error('Level pack must be a JSON object.');
  }

  const levelIds = parsed.levelIds;
  if (Array.isArray(levelIds)) {
    return levelIds.filter((value): value is string => typeof value === 'string');
  }

  const levels = parsed.levels;
  if (Array.isArray(levels)) {
    return levels
      .map((entry) => {
        if (!isObjectRecord(entry) || typeof entry.id !== 'string') {
          return null;
        }
        return entry.id;
      })
      .filter((value): value is string => value !== null);
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
