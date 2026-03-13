import { isBenchmarkRunRecord as isPublicBenchmarkRunRecord } from '@corgiban/benchmarks';

import type { BenchmarkRunRecord } from './benchmarkRecord';

const benchmarkRunLocalMetadataKeys = new Set([
  'levelRef',
  'exactLevelKey',
  'levelFingerprint',
  'comparisonLevelKey',
]);
const publicBenchmarkRunRecordKeys = new Set([
  'id',
  'suiteRunId',
  'runId',
  'sequence',
  'levelId',
  'runnableLevelKey',
  'comparisonLevelKey',
  'algorithmId',
  'repetition',
  'warmup',
  'options',
  'status',
  'metrics',
  'startedAtMs',
  'finishedAtMs',
  'solutionMoves',
  'errorMessage',
  'errorDetails',
  'environment',
  'comparableMetadata',
]);
const benchmarkRunRecordKeys = new Set([
  ...publicBenchmarkRunRecordKeys,
  'levelName',
  'localMetadata',
]);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: Set<string>): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isBenchmarkRunLocalMetadata(value: unknown): boolean {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, benchmarkRunLocalMetadataKeys)) {
    return false;
  }

  return (
    (value.levelRef === undefined || typeof value.levelRef === 'string') &&
    (value.exactLevelKey === undefined || typeof value.exactLevelKey === 'string') &&
    (value.levelFingerprint === undefined || typeof value.levelFingerprint === 'string') &&
    (value.comparisonLevelKey === undefined || typeof value.comparisonLevelKey === 'string')
  );
}

export function isPersistedBenchmarkRunRecord(value: unknown): value is BenchmarkRunRecord {
  if (!isObjectRecord(value) || !hasOnlyKeys(value, benchmarkRunRecordKeys)) {
    return false;
  }

  const { levelName, localMetadata, ...publicRecord } = value;
  if (levelName !== undefined && typeof levelName !== 'string') {
    return false;
  }

  if (localMetadata !== undefined && !isBenchmarkRunLocalMetadata(localMetadata)) {
    return false;
  }

  return isPublicBenchmarkRunRecord(publicRecord);
}
