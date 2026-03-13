import { parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';
import { builtinLevels } from '@corgiban/levels';
import { analyzeLevel } from '@corgiban/solver';

import { performance } from 'node:perf_hooks';

export type AnalyzeLevelProfileSample = {
  levelId: string;
  levelName: string;
  meanMs: number;
  totalMs: number;
};

export type AnalyzeLevelProfileOptions = {
  iterations?: number;
  warmupIterations?: number;
};

export type StressLevelOptions = {
  width?: number;
  height?: number;
  boxCount?: number;
};

const DEFAULT_ITERATIONS = 25;
const DEFAULT_WARMUP_ITERATIONS = 5;
const DEFAULT_STRESS_WIDTH = 64;
const DEFAULT_STRESS_HEIGHT = 64;
const DEFAULT_STRESS_BOX_COUNT = 40;

function toLevelRuntime(level: LevelDefinition) {
  return parseLevel(level);
}

function measureLevel(
  level: LevelDefinition,
  {
    iterations = DEFAULT_ITERATIONS,
    warmupIterations = DEFAULT_WARMUP_ITERATIONS,
  }: AnalyzeLevelProfileOptions = {},
): AnalyzeLevelProfileSample {
  const runtime = toLevelRuntime(level);

  for (let index = 0; index < warmupIterations; index += 1) {
    analyzeLevel(runtime);
  }

  const startedAt = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    analyzeLevel(runtime);
  }
  const totalMs = performance.now() - startedAt;

  return {
    levelId: level.id,
    levelName: level.name,
    meanMs: totalMs / iterations,
    totalMs,
  };
}

export function rankBuiltinAnalyzeLevelCost(
  options: AnalyzeLevelProfileOptions = {},
): AnalyzeLevelProfileSample[] {
  return builtinLevels
    .map((level) => measureLevel(level, options))
    .sort((left, right) => right.meanMs - left.meanMs);
}

export function getSlowestBuiltinAnalyzeLevelSample(
  options: AnalyzeLevelProfileOptions = {},
): AnalyzeLevelProfileSample {
  const [slowestLevel] = rankBuiltinAnalyzeLevelCost(options);
  if (!slowestLevel) {
    throw new Error('No built-in levels are available for analyzeLevel profiling.');
  }
  return slowestLevel;
}

function createEmptyGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, (_, rowIndex) =>
    Array.from({ length: width }, (_, columnIndex) => {
      if (
        rowIndex === 0 ||
        rowIndex === height - 1 ||
        columnIndex === 0 ||
        columnIndex === width - 1
      ) {
        return 'W';
      }
      return 'E';
    }),
  );
}

function listInteriorPositions(
  width: number,
  height: number,
): Array<{ row: number; column: number }> {
  const positions: Array<{ row: number; column: number }> = [];

  for (let row = 1; row < height - 1; row += 1) {
    for (let column = 1; column < width - 1; column += 1) {
      positions.push({ row, column });
    }
  }

  return positions;
}

export function createAnalyzeLevelStressLevelDefinition({
  width = DEFAULT_STRESS_WIDTH,
  height = DEFAULT_STRESS_HEIGHT,
  boxCount = DEFAULT_STRESS_BOX_COUNT,
}: StressLevelOptions = {}): LevelDefinition {
  if (!Number.isInteger(width) || width < 6) {
    throw new Error('Stress level width must be an integer >= 6.');
  }
  if (!Number.isInteger(height) || height < 6) {
    throw new Error('Stress level height must be an integer >= 6.');
  }
  if (!Number.isInteger(boxCount) || boxCount < 1) {
    throw new Error('Stress level boxCount must be an integer >= 1.');
  }

  const interiorPositions = listInteriorPositions(width, height);
  const playablePositions = interiorPositions.filter(
    ({ row, column }) => !(row === 1 && column === 1),
  );
  if (playablePositions.length < boxCount * 2) {
    throw new Error(
      'Stress level dimensions do not have enough interior space for boxes and goals.',
    );
  }

  const grid = createEmptyGrid(width, height);
  grid[1][1] = 'P';

  const boxPositions = playablePositions.slice(0, boxCount);
  const goalPositions = playablePositions.slice(-boxCount);

  for (const { row, column } of boxPositions) {
    grid[row][column] = 'B';
  }

  for (const { row, column } of goalPositions) {
    grid[row][column] = grid[row][column] === 'B' ? 'S' : 'T';
  }

  return {
    id: `profile-stress-${width}x${height}-${boxCount}`,
    name: `Profile Stress ${width}x${height} (${boxCount} boxes)`,
    rows: grid.map((row) => row.join('')),
  };
}

export function createAnalyzeLevelStressLevelJson(options: StressLevelOptions = {}): string {
  return JSON.stringify(createAnalyzeLevelStressLevelDefinition(options), null, 2);
}
