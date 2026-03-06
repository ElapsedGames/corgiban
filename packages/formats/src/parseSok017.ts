import { normalizeLevelDefinition, type LevelDefinition } from '@corgiban/levels';
import { MAX_GRID_HEIGHT, MAX_GRID_WIDTH, MAX_IMPORT_BYTES } from '@corgiban/shared';

import { normalizeImportedGrid } from './normalizeGrid';
import type { ParseFormatOptions, ParsedLevelCollection } from './types';

const MAX_SOK_RLE_REPEAT = Math.max(MAX_GRID_WIDTH, MAX_GRID_HEIGHT);
const standardBoardLinePattern = /^[#@+$*.\- _|0-9]+$/;
const unsupportedBoardCandidatePattern = /^[#@+$*.\- _|0-9A-Za-z<>^v=&]+$/;
const boardStructurePattern = /[#@+$*.|<>^v=&]/;

function isBoardLine(line: string): boolean {
  return (
    standardBoardLinePattern.test(line) ||
    (unsupportedBoardCandidatePattern.test(line) && boardStructurePattern.test(line))
  );
}

function assertSokImportSize(text: string): void {
  const importBytes = new TextEncoder().encode(text).byteLength;
  if (importBytes <= MAX_IMPORT_BYTES) {
    return;
  }

  const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
  const importMb = (importBytes / 1024 / 1024).toFixed(1);
  throw new Error(`Imported level text is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
}

function parseRepeatCount(digits: string): number {
  if (digits.length === 0) {
    return 1;
  }

  let repeat = 0;
  for (const digit of digits) {
    repeat = repeat * 10 + Number.parseInt(digit, 10);
    if (repeat > MAX_SOK_RLE_REPEAT) {
      throw new Error(
        `Decoded SOK 0.17 repeat ${repeat} exceeds supported grid limits (${MAX_GRID_WIDTH}x${MAX_GRID_HEIGHT}).`,
      );
    }
  }

  return repeat;
}

function decodeSokRleRow(value: string, startingRowCount = 0): string[] {
  const rows: string[] = [];
  let currentRow = '';
  let pendingDigits = '';

  const flushRow = () => {
    const decodedHeight = startingRowCount + rows.length + 1;
    if (decodedHeight > MAX_GRID_HEIGHT) {
      throw new Error(
        `Decoded SOK 0.17 height ${decodedHeight} exceeds MAX_GRID_HEIGHT ${MAX_GRID_HEIGHT}.`,
      );
    }
    rows.push(currentRow);
    currentRow = '';
  };

  const applyToken = (token: string) => {
    const repeat = Math.max(1, parseRepeatCount(pendingDigits));
    pendingDigits = '';

    if (token === '|') {
      for (let index = 0; index < repeat; index += 1) {
        flushRow();
      }
      return;
    }

    const projectedWidth = currentRow.length + repeat;
    if (projectedWidth > MAX_GRID_WIDTH) {
      throw new Error(
        `Decoded SOK 0.17 row width ${projectedWidth} exceeds MAX_GRID_WIDTH ${MAX_GRID_WIDTH}.`,
      );
    }

    currentRow += token.repeat(repeat);
  };

  for (const token of value) {
    if (/[0-9]/.test(token)) {
      pendingDigits += token;
      continue;
    }
    applyToken(token);
  }

  if (pendingDigits.length > 0) {
    throw new Error('Invalid SOK 0.17 RLE: trailing digit without token.');
  }

  if (currentRow.length > 0 || rows.length === 0) {
    flushRow();
  }

  return rows;
}

function sanitizeIdPart(value: string): string {
  const collapsed = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return collapsed.length > 0 ? collapsed : 'level';
}

function parseSokBlocks(text: string): Array<{ title: string | null; rows: string[] }> {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Array<{ title: string | null; rows: string[] }> = [];

  let title: string | null = null;
  let rows: string[] = [];

  const flush = () => {
    if (rows.length === 0) {
      return;
    }
    blocks.push({ title, rows });
    rows = [];
    title = null;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Preserve raw row whitespace so SOK imports keep ragged geometry intact.
    if (line.length > 0 && isBoardLine(line)) {
      rows.push(...decodeSokRleRow(line, rows.length));
      return;
    }

    if (trimmed.length === 0) {
      flush();
      return;
    }

    if (trimmed.startsWith(';')) {
      if (rows.length === 0) {
        title = trimmed.slice(1).trim() || title;
      }
      return;
    }

    if (/^title\s*:/i.test(trimmed)) {
      title = trimmed.replace(/^title\s*:/i, '').trim() || title;
      return;
    }

    throw new Error(`Unsupported SOK 0.17 line: "${line}".`);
  });

  flush();
  return blocks;
}

export function parseSok017(text: string, options: ParseFormatOptions = {}): ParsedLevelCollection {
  assertSokImportSize(text);
  const blocks = parseSokBlocks(text);
  if (blocks.length === 0) {
    throw new Error('No SOK 0.17 levels were found.');
  }

  const warnings: ParsedLevelCollection['warnings'] = [];
  const levels: LevelDefinition[] = blocks.map((block, index) => {
    const normalized = normalizeImportedGrid(block.rows, {
      source: 'sok-0.17',
      strictClosedValidation: options.strictClosedValidation,
      allowOpenPuzzles: options.allowOpenPuzzles,
      allowUnsupportedVariants: options.allowUnsupportedVariants,
    });

    const id = `${options.collectionId ?? 'sok'}-${String(index + 1).padStart(3, '0')}-${sanitizeIdPart(block.title ?? '')}`;
    const name = block.title ?? `SOK ${index + 1}`;

    warnings.push(...normalized.warnings.map((warning) => ({ ...warning, levelId: id })));

    return normalizeLevelDefinition({
      id,
      name,
      rows: normalized.rows,
      knownSolution: null,
    });
  });

  return {
    id: options.collectionId ?? 'sok-import',
    title: options.collectionTitle ?? 'SOK 0.17 Import',
    levels,
    warnings,
  };
}
