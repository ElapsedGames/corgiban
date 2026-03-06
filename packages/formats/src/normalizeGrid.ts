import { MAX_BOXES, MAX_GRID_HEIGHT, MAX_GRID_WIDTH, MAX_IMPORT_BYTES } from '@corgiban/shared';

import type {
  FormatParseWarning,
  NormalizeImportedGridOptions,
  NormalizeImportedGridResult,
  UnsupportedVariant,
} from './types';

const TOKEN_WALL = '#';
const TOKEN_TARGET = '.';
const TOKEN_PLAYER = '@';
const TOKEN_PLAYER_ON_TARGET = '+';
const TOKEN_BOX = '$';
const TOKEN_BOX_ON_TARGET = '*';
const TOKEN_FLOOR_SPACE = ' ';
const TOKEN_FLOOR_DASH = '-';
const TOKEN_FLOOR_UNDERSCORE = '_';

const INTERNAL_WALL = 'W';
const INTERNAL_TARGET = 'T';
const INTERNAL_PLAYER = 'P';
const INTERNAL_PLAYER_ON_TARGET = 'Q';
const INTERNAL_BOX = 'B';
const INTERNAL_BOX_ON_TARGET = 'S';
const INTERNAL_FLOOR = 'E';

const allowedSourceTokens = new Set([
  TOKEN_WALL,
  TOKEN_TARGET,
  TOKEN_PLAYER,
  TOKEN_PLAYER_ON_TARGET,
  TOKEN_BOX,
  TOKEN_BOX_ON_TARGET,
  TOKEN_FLOOR_SPACE,
  TOKEN_FLOOR_DASH,
  TOKEN_FLOOR_UNDERSCORE,
]);

function assertImportSize(text: string): void {
  const importBytes = new TextEncoder().encode(text).byteLength;
  if (importBytes <= MAX_IMPORT_BYTES) {
    return;
  }

  const maxMb = (MAX_IMPORT_BYTES / 1024 / 1024).toFixed(1);
  const importMb = (importBytes / 1024 / 1024).toFixed(1);
  throw new Error(`Imported level text is too large (${importMb} MB). Maximum is ${maxMb} MB.`);
}

function toInternalCell(token: string): string {
  switch (token) {
    case TOKEN_WALL:
      return INTERNAL_WALL;
    case TOKEN_TARGET:
      return INTERNAL_TARGET;
    case TOKEN_PLAYER:
      return INTERNAL_PLAYER;
    case TOKEN_PLAYER_ON_TARGET:
      return INTERNAL_PLAYER_ON_TARGET;
    case TOKEN_BOX:
      return INTERNAL_BOX;
    case TOKEN_BOX_ON_TARGET:
      return INTERNAL_BOX_ON_TARGET;
    case TOKEN_FLOOR_SPACE:
    case TOKEN_FLOOR_DASH:
    case TOKEN_FLOOR_UNDERSCORE:
      return INTERNAL_FLOOR;
    default:
      throw new Error(`Unsupported board token "${token}".`);
  }
}

function detectUnsupportedVariants(rows: string[]): UnsupportedVariant[] {
  const variants = new Set<UnsupportedVariant>();

  rows.forEach((row) => {
    for (const token of row) {
      if (/[0-9]/.test(token)) {
        variants.add('numbered');
        continue;
      }

      if (/[a-zA-Z]/.test(token) && !allowedSourceTokens.has(token)) {
        variants.add('multiban');
        continue;
      }

      if (token === '<' || token === '>' || token === '^' || token === 'v') {
        variants.add('hexoban');
        continue;
      }

      if (token === '=' || token === '&') {
        variants.add('modern');
      }
    }
  });

  return [...variants].sort();
}

function sanitizeUnsupportedTokens(rows: string[]): string[] {
  return rows.map((row) => {
    let sanitized = '';
    for (const token of row) {
      sanitized += allowedSourceTokens.has(token) ? token : TOKEN_FLOOR_SPACE;
    }
    return sanitized;
  });
}

function assertRows(rows: string[]): void {
  if (rows.length === 0) {
    throw new Error('Imported level is empty.');
  }

  rows.forEach((row, index) => {
    if (row.includes('\t')) {
      throw new Error(`Tabs are not allowed in imported rows (row ${index + 1}).`);
    }
  });

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const height = rows.length;

  if (width > MAX_GRID_WIDTH) {
    throw new Error(`Imported level width ${width} exceeds MAX_GRID_WIDTH ${MAX_GRID_WIDTH}.`);
  }

  if (height > MAX_GRID_HEIGHT) {
    throw new Error(`Imported level height ${height} exceeds MAX_GRID_HEIGHT ${MAX_GRID_HEIGHT}.`);
  }
}

function paddedInternalGrid(rows: string[]): { width: number; height: number; grid: string[] } {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const height = rows.length;
  const grid = new Array(width * height).fill(INTERNAL_FLOOR);

  rows.forEach((row, rowIndex) => {
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const token = row[colIndex];
      if (!allowedSourceTokens.has(token)) {
        throw new Error(`Unsupported board token "${token}" at row ${rowIndex + 1}.`);
      }
      grid[rowIndex * width + colIndex] = toInternalCell(token);
    }
  });

  return {
    width,
    height,
    grid,
  };
}

function floodFill(
  width: number,
  height: number,
  passable: (cell: string) => boolean,
  grid: string[],
): boolean[] {
  const visited = new Array<boolean>(width * height).fill(false);
  const queue: number[] = [];

  const tryQueue = (row: number, col: number) => {
    const index = row * width + col;
    if (visited[index]) {
      return;
    }
    if (!passable(grid[index])) {
      return;
    }
    visited[index] = true;
    queue.push(index);
  };

  for (let row = 0; row < height; row += 1) {
    tryQueue(row, 0);
    tryQueue(row, width - 1);
  }

  for (let col = 0; col < width; col += 1) {
    tryQueue(0, col);
    tryQueue(height - 1, col);
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;

    const row = Math.floor(index / width);
    const col = index % width;
    const neighbors = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ];

    neighbors.forEach(([nextRow, nextCol]) => {
      if (nextRow < 0 || nextRow >= height || nextCol < 0 || nextCol >= width) {
        return;
      }
      const nextIndex = nextRow * width + nextCol;
      if (visited[nextIndex]) {
        return;
      }
      if (!passable(grid[nextIndex])) {
        return;
      }
      visited[nextIndex] = true;
      queue.push(nextIndex);
    });
  }

  return visited;
}

function isPuzzleToken(cell: string): boolean {
  return (
    cell === INTERNAL_TARGET ||
    cell === INTERNAL_PLAYER ||
    cell === INTERNAL_PLAYER_ON_TARGET ||
    cell === INTERNAL_BOX ||
    cell === INTERNAL_BOX_ON_TARGET
  );
}

function validatePuzzleClosure(
  grid: string[],
  width: number,
  height: number,
  allowOpen: boolean,
): 'closed' | 'open' {
  const borderReachable = floodFill(width, height, (cell) => cell !== INTERNAL_WALL, grid);

  const isOpen = borderReachable.some(
    (reachable, index) => reachable && isPuzzleToken(grid[index]),
  );
  if (isOpen && !allowOpen) {
    throw new Error('Imported level appears to be open/unclosed.');
  }

  return isOpen ? 'open' : 'closed';
}

function topologyCrop(
  grid: string[],
  width: number,
  height: number,
): { rows: string[]; trimmedOutsideFloorCount: number } {
  const outsideFloor = floodFill(width, height, (cell) => cell === INTERNAL_FLOOR, grid);
  const trimmedOutsideFloorCount = outsideFloor.filter(Boolean).length;

  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  let minCol = Number.POSITIVE_INFINITY;
  let maxCol = Number.NEGATIVE_INFINITY;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const index = row * width + col;
      const keepCell = grid[index] !== INTERNAL_FLOOR || !outsideFloor[index];
      if (!keepCell) {
        continue;
      }

      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
    }
  }

  if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
    throw new Error('Imported level contains no puzzle cells after normalization.');
  }

  const rows: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    let outRow = '';
    for (let col = minCol; col <= maxCol; col += 1) {
      outRow += grid[row * width + col];
    }
    rows.push(outRow);
  }

  return {
    rows,
    trimmedOutsideFloorCount,
  };
}

function assertCoreLevelInvariants(rows: string[]): void {
  let playerCount = 0;
  let boxCount = 0;
  let boxesOnTargets = 0;

  rows.forEach((row) => {
    for (const token of row) {
      if (token === INTERNAL_PLAYER || token === INTERNAL_PLAYER_ON_TARGET) {
        playerCount += 1;
      }
      if (token === INTERNAL_BOX || token === INTERNAL_BOX_ON_TARGET) {
        boxCount += 1;
      }
      if (token === INTERNAL_BOX_ON_TARGET) {
        boxesOnTargets += 1;
      }
    }
  });

  if (playerCount !== 1) {
    throw new Error('Imported level must contain exactly one player.');
  }

  if (boxCount > MAX_BOXES) {
    throw new Error(`Imported level has ${boxCount} boxes, exceeds MAX_BOXES ${MAX_BOXES}.`);
  }

  if (boxCount > 0 && boxesOnTargets === boxCount) {
    throw new Error('Imported level has all boxes on targets at start.');
  }
}

function levelWarning(code: FormatParseWarning['code'], message: string): FormatParseWarning {
  return { code, message };
}

export function normalizeImportedGrid(
  sourceRows: string[],
  options: NormalizeImportedGridOptions,
): NormalizeImportedGridResult {
  const joined = sourceRows.join('\n');
  assertImportSize(joined);
  assertRows(sourceRows);

  const unsupportedVariants = detectUnsupportedVariants(sourceRows);
  if (unsupportedVariants.length > 0 && !options.allowUnsupportedVariants) {
    throw new Error(`Unsupported variant tokens detected: ${unsupportedVariants.join(', ')}.`);
  }

  const rowsForGrid =
    unsupportedVariants.length > 0 && options.allowUnsupportedVariants
      ? sanitizeUnsupportedTokens(sourceRows)
      : sourceRows;

  const { width, height, grid } = paddedInternalGrid(rowsForGrid);
  const puzzleClosure = validatePuzzleClosure(
    grid,
    width,
    height,
    options.allowOpenPuzzles === true,
  );

  const crop = topologyCrop(grid, width, height);
  if (
    puzzleClosure === 'closed' &&
    options.strictClosedValidation &&
    crop.trimmedOutsideFloorCount > 0
  ) {
    throw new Error(
      'Strict closed validation rejects imported levels that require topology crop to remove exterior floor padding.',
    );
  }

  assertCoreLevelInvariants(crop.rows);

  const warnings: FormatParseWarning[] = [];
  if (unsupportedVariants.length > 0) {
    warnings.push(
      levelWarning(
        'unsupported-variant-carried',
        `Unsupported variants retained in diagnostics: ${unsupportedVariants.join(', ')}.`,
      ),
    );
  }

  if (puzzleClosure === 'open') {
    warnings.push(
      levelWarning(
        'open-puzzle-validation-skipped',
        'Open puzzle accepted because allowOpenPuzzles is enabled.',
      ),
    );
  } else {
    warnings.push(
      levelWarning(
        'closed-puzzle-validated',
        options.strictClosedValidation
          ? 'Closed puzzle validation completed in strict mode.'
          : 'Closed puzzle validation completed.',
      ),
    );
  }

  return {
    rows: crop.rows,
    warnings,
    unsupportedVariants,
  };
}

export function formatRowsToXsb(rows: string[]): string[] {
  return rows.map((row) => {
    let serialized = '';
    for (const token of row) {
      switch (token) {
        case INTERNAL_WALL:
          serialized += TOKEN_WALL;
          break;
        case INTERNAL_TARGET:
          serialized += TOKEN_TARGET;
          break;
        case INTERNAL_PLAYER:
          serialized += TOKEN_PLAYER;
          break;
        case INTERNAL_PLAYER_ON_TARGET:
          serialized += TOKEN_PLAYER_ON_TARGET;
          break;
        case INTERNAL_BOX:
          serialized += TOKEN_BOX;
          break;
        case INTERNAL_BOX_ON_TARGET:
          serialized += TOKEN_BOX_ON_TARGET;
          break;
        case INTERNAL_FLOOR:
        case TOKEN_FLOOR_SPACE:
          serialized += TOKEN_FLOOR_SPACE;
          break;
        default:
          throw new Error(`Cannot serialize unknown internal token "${token}".`);
      }
    }
    return serialized;
  });
}
