import type { LevelDefinition } from '@corgiban/levels';
import { parseLevel } from '@corgiban/core';
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

const FALLBACK_LAB_LEVEL_TEXT = ['#####', '#.@ #', '# $ #', '# . #', '#####'].join('\n');

export function defaultLabLevelText(): string {
  const defaultLevel = builtinLevels[0];
  if (!defaultLevel) {
    return FALLBACK_LAB_LEVEL_TEXT;
  }

  return serializeXsb(defaultLevel, { includeTitleComment: false });
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
    const resolvedLevel = {
      id: typeof level.id === 'string' ? level.id : 'lab-level',
      name: typeof level.name === 'string' ? level.name : 'Lab Level',
      rows: level.rows,
      knownSolution: typeof level.knownSolution === 'string' ? level.knownSolution : null,
    };
    parseLevel(resolvedLevel);
    return {
      level: resolvedLevel,
      normalizedInput: JSON.stringify(resolvedLevel, null, 2),
      normalizedFormat: 'corg',
    };
  }

  const rows = input.replace(/\r\n?/g, '\n').split('\n');
  const level = {
    id: 'lab-level',
    name: 'Lab Level',
    rows,
    knownSolution: null,
  };
  parseLevel(level);
  return {
    level,
    normalizedInput: rows.join('\n'),
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
      normalizedInput: serializeXsb(level, { includeTitleComment: false }),
      normalizedFormat: 'xsb',
    };
  }

  if (format === 'sok-0.17') {
    const collection = parseSok017(input, { collectionId: 'lab' });
    const level = takeFirst(collection);
    return {
      level,
      normalizedInput: serializeSok017(level),
      normalizedFormat: 'sok-0.17',
    };
  }

  const collection = parseSlcXml(input, { collectionId: 'lab' });
  const level = takeFirst(collection);
  return {
    level,
    normalizedInput: serializeSlcXml(level),
    normalizedFormat: 'slc-xml',
  };
}
