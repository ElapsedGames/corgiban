import type { LevelDefinition } from '@corgiban/levels';
import { MAX_BOXES, MAX_GRID_HEIGHT, MAX_GRID_WIDTH } from '@corgiban/shared';

import { STATIC_FLOOR, STATIC_TARGET, STATIC_WALL } from '../model/cell';
import type { LevelRuntime } from '../model/level';

function countLeadingWhitespace(row: string): number {
  const match = row.match(/^[ ]*/);
  return match ? match[0].length : 0;
}

function normalizeRows(rows: string[]): { rows: string[]; width: number } {
  if (rows.length === 0) {
    throw new Error('Level must contain at least one row.');
  }

  for (const row of rows) {
    if (row.includes('\t')) {
      throw new Error('Tabs are not allowed in level rows.');
    }
  }

  const nonEmptyRows = rows.filter((row) => row.trim().length > 0);
  if (nonEmptyRows.length === 0) {
    throw new Error('Level rows must not be empty.');
  }

  const indent = Math.min(...nonEmptyRows.map((row) => countLeadingWhitespace(row)));

  const strippedRows = rows.map((row) => row.slice(indent));
  const width = strippedRows.reduce((maxWidth, row) => Math.max(maxWidth, row.length), 0);

  if (width === 0) {
    throw new Error('Level rows must not be empty.');
  }

  const paddedRows = strippedRows.map((row) => row.padEnd(width, ' '));
  return { rows: paddedRows, width };
}

export function parseLevel(definition: LevelDefinition): LevelRuntime {
  const { rows: normalizedRows, width } = normalizeRows(definition.rows);
  const height = normalizedRows.length;
  if (height > MAX_GRID_HEIGHT) {
    throw new Error(`Level height ${height} exceeds MAX_GRID_HEIGHT ${MAX_GRID_HEIGHT}.`);
  }

  if (width > MAX_GRID_WIDTH) {
    throw new Error(`Level width ${width} exceeds MAX_GRID_WIDTH ${MAX_GRID_WIDTH}.`);
  }

  const staticGrid = new Uint8Array(width * height);
  const boxes: number[] = [];
  let playerIndex = -1;

  normalizedRows.forEach((row, rowIndex) => {
    [...row].forEach((token, colIndex) => {
      const index = rowIndex * width + colIndex;
      switch (token) {
        case 'W':
          staticGrid[index] = STATIC_WALL;
          break;
        case 'E':
        case ' ':
          staticGrid[index] = STATIC_FLOOR;
          break;
        case 'T':
          staticGrid[index] = STATIC_TARGET;
          break;
        case 'P':
          if (playerIndex !== -1) {
            throw new Error('Level must contain exactly one player.');
          }
          staticGrid[index] = STATIC_FLOOR;
          playerIndex = index;
          break;
        case 'Q':
          if (playerIndex !== -1) {
            throw new Error('Level must contain exactly one player.');
          }
          staticGrid[index] = STATIC_TARGET;
          playerIndex = index;
          break;
        case 'B':
          staticGrid[index] = STATIC_FLOOR;
          boxes.push(index);
          break;
        case 'S':
          staticGrid[index] = STATIC_TARGET;
          boxes.push(index);
          break;
        default:
          throw new Error(`Unknown token "${token}" at row ${rowIndex + 1}, col ${colIndex + 1}.`);
      }
    });
  });

  if (playerIndex === -1) {
    throw new Error('Level must contain exactly one player.');
  }

  if (boxes.length > MAX_BOXES) {
    throw new Error(`Level has ${boxes.length} boxes, exceeds MAX_BOXES ${MAX_BOXES}.`);
  }

  boxes.sort((a, b) => a - b);
  const allBoxesOnTargets =
    boxes.length > 0 && boxes.every((boxIndex) => staticGrid[boxIndex] === STATIC_TARGET);
  if (allBoxesOnTargets) {
    throw new Error('Levels with all boxes on targets at start are not supported.');
  }

  return {
    levelId: definition.id,
    width,
    height,
    staticGrid,
    initialPlayerIndex: playerIndex,
    initialBoxes: Uint32Array.from(boxes),
  };
}
