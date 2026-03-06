import { normalizeLevelDefinition, type LevelDefinition } from '@corgiban/levels';
import { MAX_IMPORT_BYTES } from '@corgiban/shared';

import { normalizeImportedGrid } from './normalizeGrid';
import type { ParseFormatOptions, ParsedLevelCollection } from './types';

const standardBoardTokenPattern = /^[#@+$*.\- _]+$/;
const unsupportedBoardCandidatePattern = /^[#@+$*.\- _0-9A-Za-z<>^v=&]+$/;
const boardStructurePattern = /[#@+$*.<>^v=&]/;

function isBoardRow(line: string): boolean {
  return (
    standardBoardTokenPattern.test(line) ||
    (unsupportedBoardCandidatePattern.test(line) && boardStructurePattern.test(line))
  );
}

function assertImportSize(text: string): void {
  const importBytes = new TextEncoder().encode(text).byteLength;
  if (importBytes <= MAX_IMPORT_BYTES) {
    return;
  }

  const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
  const importMb = (importBytes / 1024 / 1024).toFixed(1);
  throw new Error(`Imported level text is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
}

function sanitizeIdPart(value: string): string {
  const collapsed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return collapsed.length > 0 ? collapsed : 'level';
}

function parseXsbBlocks(text: string): Array<{ title: string | null; rows: string[] }> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Array<{ title: string | null; rows: string[] }> = [];

  let pendingTitle: string | null = null;
  let activeRows: string[] = [];

  const flush = () => {
    if (activeRows.length === 0) {
      return;
    }

    blocks.push({
      title: pendingTitle,
      rows: activeRows,
    });
    activeRows = [];
    pendingTitle = null;
  };

  lines.forEach((rawLine) => {
    const line = rawLine;
    const trimmed = line.trim();

    if (trimmed.startsWith(';')) {
      if (activeRows.length === 0) {
        pendingTitle = trimmed.slice(1).trim() || pendingTitle;
      }
      return;
    }

    if (trimmed.length === 0) {
      flush();
      return;
    }

    if (isBoardRow(line)) {
      activeRows.push(line);
      return;
    }

    if (activeRows.length === 0) {
      pendingTitle = trimmed;
      return;
    }

    throw new Error(`Unsupported XSB line: "${line}".`);
  });

  flush();
  return blocks;
}

export function parseXsb(text: string, options: ParseFormatOptions = {}): ParsedLevelCollection {
  assertImportSize(text);
  const blocks = parseXsbBlocks(text);
  if (blocks.length === 0) {
    throw new Error('No XSB levels were found.');
  }

  const warnings: ParsedLevelCollection['warnings'] = [];
  const levels: LevelDefinition[] = blocks.map((block, index) => {
    const normalized = normalizeImportedGrid(block.rows, {
      source: 'xsb',
      strictClosedValidation: options.strictClosedValidation,
      allowOpenPuzzles: options.allowOpenPuzzles,
      allowUnsupportedVariants: options.allowUnsupportedVariants,
    });

    const id = `${options.collectionId ?? 'xsb'}-${String(index + 1).padStart(3, '0')}-${sanitizeIdPart(block.title ?? '')}`;
    const name = block.title ?? `XSB ${index + 1}`;

    warnings.push(...normalized.warnings.map((warning) => ({ ...warning, levelId: id })));

    return normalizeLevelDefinition({
      id,
      name,
      rows: normalized.rows,
      knownSolution: null,
    });
  });

  return {
    id: options.collectionId ?? 'xsb-import',
    title: options.collectionTitle ?? 'XSB Import',
    levels,
    warnings,
  };
}
