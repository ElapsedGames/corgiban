import type { BenchmarkRunRecord as PublicBenchmarkRunRecord } from '@corgiban/benchmarks';
import type { LevelDefinition } from '@corgiban/levels';

import { createPlayableExactLevelKey } from '../levels/playableIdentity';

export type BenchmarkRunLocalMetadata = {
  levelRef?: string;
  exactLevelKey?: string;
  levelFingerprint?: string;
  comparisonLevelKey?: string;
};

export type BenchmarkRunRecord = PublicBenchmarkRunRecord & {
  levelName?: string;
  localMetadata?: BenchmarkRunLocalMetadata;
};

export function createBenchmarkRunnableLevelKey(level: LevelDefinition): string {
  return createPlayableExactLevelKey(level);
}

export function createBenchmarkComparisonLevelKey(level: LevelDefinition): string {
  return createBenchmarkRunnableLevelKey(level);
}

export function toPublicBenchmarkRunRecord(record: BenchmarkRunRecord): PublicBenchmarkRunRecord {
  const { levelName: _levelName, localMetadata: _localMetadata, ...publicRecord } = record;
  return publicRecord;
}

export function toPublicBenchmarkRunRecords(
  records: BenchmarkRunRecord[],
): PublicBenchmarkRunRecord[] {
  return records.map(toPublicBenchmarkRunRecord);
}

export function resolveBenchmarkResultLevelName(record: BenchmarkRunRecord): string {
  return record.levelName ?? record.levelId;
}

export function resolveBenchmarkRunnableLevelKey(record: BenchmarkRunRecord): string | undefined {
  return (
    record.localMetadata?.exactLevelKey ??
    record.localMetadata?.levelFingerprint ??
    record.runnableLevelKey ??
    record.comparisonLevelKey
  );
}

export function resolveBenchmarkComparisonLevelKey(record: BenchmarkRunRecord): string {
  return record.comparisonLevelKey ?? record.localMetadata?.comparisonLevelKey ?? record.levelId;
}
