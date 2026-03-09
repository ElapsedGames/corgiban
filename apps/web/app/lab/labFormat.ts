import type { LevelDefinition } from '@corgiban/levels';
import { parseLevel, serializeLevel } from '@corgiban/core';
import {
  parseSlcXml,
  parseSok017,
  parseXsb,
  serializeSlcXml,
  serializeSok017,
  serializeXsb,
} from '@corgiban/formats';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { builtinLevels } from '@corgiban/levels';

export type LabInputFormat = 'corg' | 'xsb' | 'sok-0.17' | 'slc-xml';

export type ParsedLabLevel = {
  level: LevelDefinition;
  normalizedInput: string;
  normalizedFormat: LabInputFormat;
};

export const LAB_INPUT_FORMAT_LABELS: Record<LabInputFormat, string> = {
  corg: 'CORG',
  xsb: 'XSB',
  'sok-0.17': 'SOK 0.17',
  'slc-xml': 'SLC XML',
};

const FALLBACK_LAB_LEVEL_TEXT = ['WWWWW', 'WP  W', 'W B W', 'W T W', 'WWWWW'].join('\n');
const DEFAULT_LAB_LEVEL_ID = 'lab-level';
const DEFAULT_LAB_LEVEL_NAME = 'Lab Level';

export function defaultLabLevelText(): string {
  const defaultLevel = builtinLevels[0];
  if (!defaultLevel) {
    return FALLBACK_LAB_LEVEL_TEXT;
  }

  return serializeLevel(parseLevel(defaultLevel)).join('\n');
}

function assertImportSize(input: string): void {
  const importBytes = new TextEncoder().encode(input).byteLength;
  if (importBytes <= MAX_IMPORT_BYTES) {
    return;
  }

  const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
  const importMb = (importBytes / 1024 / 1024).toFixed(1);
  throw new Error(`Imported level text is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
}

function normalizeLabLevel(level: LevelDefinition): LevelDefinition {
  return {
    id: typeof level.id === 'string' ? level.id : DEFAULT_LAB_LEVEL_ID,
    name: typeof level.name === 'string' ? level.name : DEFAULT_LAB_LEVEL_NAME,
    rows: level.rows,
    knownSolution: typeof level.knownSolution === 'string' ? level.knownSolution : null,
  };
}

function toDisplayCorgRows(rows: readonly string[]): string[] {
  return rows.map((row) => row.replaceAll('E', ' '));
}

function serializeCorgJsonLevel(level: LevelDefinition): string {
  const normalizedLevel = normalizeLabLevel(level);
  return JSON.stringify(
    {
      ...normalizedLevel,
      rows: toDisplayCorgRows(normalizedLevel.rows),
    },
    null,
    2,
  );
}

function serializeCorgLevel(level: LevelDefinition): string {
  const normalizedLevel = normalizeLabLevel(level);
  const shouldUseRowsOnly =
    normalizedLevel.id === DEFAULT_LAB_LEVEL_ID &&
    normalizedLevel.name === DEFAULT_LAB_LEVEL_NAME &&
    normalizedLevel.knownSolution === null;

  if (shouldUseRowsOnly) {
    return toDisplayCorgRows(normalizedLevel.rows).join('\n');
  }

  return serializeCorgJsonLevel(normalizedLevel);
}

export function serializeLabLevel(level: LevelDefinition, format: LabInputFormat): string {
  if (format === 'corg') {
    return serializeCorgLevel(level);
  }

  if (format === 'xsb') {
    return serializeXsb(level, { includeTitleComment: false });
  }

  if (format === 'sok-0.17') {
    return serializeSok017(level);
  }

  return serializeSlcXml(level);
}

function parseCorgLevel(input: string): ParsedLabLevel {
  assertImportSize(input);
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('CORG input is empty.');
  }

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)) {
    const level = parsed as LevelDefinition;
    const resolvedLevel = normalizeLabLevel(level);
    parseLevel(resolvedLevel);
    return {
      level: resolvedLevel,
      normalizedInput: serializeCorgJsonLevel(resolvedLevel),
      normalizedFormat: 'corg',
    };
  }

  const rows = input.replace(/\r\n?/g, '\n').split('\n');
  const level = {
    id: DEFAULT_LAB_LEVEL_ID,
    name: DEFAULT_LAB_LEVEL_NAME,
    rows,
    knownSolution: null,
  };
  parseLevel(level);
  return {
    level,
    normalizedInput: serializeCorgLevel(level),
    normalizedFormat: 'corg',
  };
}

function takeFirst(collection: { levels: LevelDefinition[] }): LevelDefinition {
  const first = collection.levels[0];
  if (!first) {
    throw new Error('No levels were parsed from input.');
  }
  if (collection.levels.length > 1) {
    throw new Error(
      `Multi-level input is not supported in the lab editor. Input contains ${collection.levels.length} levels; paste a single level only.`,
    );
  }
  return first;
}

export function parseLabInput(format: LabInputFormat, input: string): ParsedLabLevel {
  if (format === 'corg') {
    return parseCorgLevel(input);
  }

  if (format === 'xsb') {
    const collection = parseXsb(input, { collectionId: 'lab' });
    const level = takeFirst(collection);
    return {
      level,
      normalizedInput: serializeLabLevel(level, 'xsb'),
      normalizedFormat: 'xsb',
    };
  }

  if (format === 'sok-0.17') {
    const collection = parseSok017(input, { collectionId: 'lab' });
    const level = takeFirst(collection);
    return {
      level,
      normalizedInput: serializeLabLevel(level, 'sok-0.17'),
      normalizedFormat: 'sok-0.17',
    };
  }

  const collection = parseSlcXml(input, { collectionId: 'lab' });
  const level = takeFirst(collection);
  return {
    level,
    normalizedInput: serializeLabLevel(level, 'slc-xml'),
    normalizedFormat: 'slc-xml',
  };
}

export function convertLabInputFormat(
  sourceFormat: LabInputFormat,
  targetFormat: LabInputFormat,
  input: string,
): ParsedLabLevel {
  const parsed = parseLabInput(sourceFormat, input);

  return {
    level: parsed.level,
    normalizedInput: serializeLabLevel(parsed.level, targetFormat),
    normalizedFormat: targetFormat,
  };
}
