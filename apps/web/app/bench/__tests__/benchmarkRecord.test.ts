import { describe, expect, it } from 'vitest';

import type { BenchmarkRunRecord } from '../benchmarkRecord';
import {
  resolveBenchmarkComparisonLevelKey,
  resolveBenchmarkRunnableLevelKey,
  resolveBenchmarkResultLevelName,
  toPublicBenchmarkRunRecord,
  toPublicBenchmarkRunRecords,
} from '../benchmarkRecord';
import { isPersistedBenchmarkRunRecord } from '../benchmarkRecordPersistence';

function createRecord(overrides: Partial<BenchmarkRunRecord> = {}): BenchmarkRunRecord {
  return {
    id: 'result-1',
    suiteRunId: 'suite-1',
    runId: 'run-1',
    sequence: 1,
    levelId: 'corgiban-test-18',
    algorithmId: 'bfsPush',
    repetition: 1,
    options: {
      timeBudgetMs: 1_000,
      nodeBudget: 5_000,
    },
    status: 'solved',
    metrics: {
      elapsedMs: 10,
      expanded: 20,
      generated: 25,
      maxDepth: 4,
      maxFrontier: 8,
      pushCount: 2,
      moveCount: 4,
    },
    startedAtMs: 10,
    finishedAtMs: 20,
    environment: {
      userAgent: 'test',
      hardwareConcurrency: 4,
      appVersion: 'test',
    },
    ...overrides,
  };
}

describe('benchmarkRecord', () => {
  it('strips session-only metadata and display-only fields from public export records', () => {
    const record = createRecord({
      runnableLevelKey: 'edited-builtin:exact-1',
      comparisonLevelKey: 'edited-builtin:fingerprint-1',
      levelName: 'Edited Builtin Variant',
      localMetadata: {
        levelRef: 'temp:edited-builtin',
        exactLevelKey: 'edited-builtin:exact-1',
        levelFingerprint: 'edited-builtin:exact-1',
        comparisonLevelKey: 'edited-builtin:fingerprint-1',
      },
    });

    expect(toPublicBenchmarkRunRecord(record)).toEqual({
      id: 'result-1',
      suiteRunId: 'suite-1',
      runId: 'run-1',
      sequence: 1,
      levelId: 'corgiban-test-18',
      runnableLevelKey: 'edited-builtin:exact-1',
      comparisonLevelKey: 'edited-builtin:fingerprint-1',
      algorithmId: 'bfsPush',
      repetition: 1,
      options: {
        timeBudgetMs: 1_000,
        nodeBudget: 5_000,
      },
      status: 'solved',
      metrics: {
        elapsedMs: 10,
        expanded: 20,
        generated: 25,
        maxDepth: 4,
        maxFrontier: 8,
        pushCount: 2,
        moveCount: 4,
      },
      startedAtMs: 10,
      finishedAtMs: 20,
      environment: {
        userAgent: 'test',
        hardwareConcurrency: 4,
        appVersion: 'test',
      },
    });
    expect(toPublicBenchmarkRunRecords([record])).toEqual([toPublicBenchmarkRunRecord(record)]);
  });

  it('resolves display names and comparison keys with local overrides when present', () => {
    const record = createRecord({
      runnableLevelKey: 'public-exact-key',
      comparisonLevelKey: 'public-comparison-key',
      levelName: 'Edited Builtin Variant',
      localMetadata: {
        exactLevelKey: 'local-exact-key',
        comparisonLevelKey: 'edited-builtin:fingerprint-1',
      },
    });

    expect(resolveBenchmarkResultLevelName(record)).toBe('Edited Builtin Variant');
    expect(resolveBenchmarkRunnableLevelKey(record)).toBe('local-exact-key');
    expect(resolveBenchmarkComparisonLevelKey(record)).toBe('public-comparison-key');
    expect(resolveBenchmarkComparisonLevelKey(createRecord())).toBe('corgiban-test-18');
    expect(resolveBenchmarkRunnableLevelKey(createRecord())).toBeUndefined();
  });
});

describe('benchmarkRecordPersistence', () => {
  it('accepts both legacy public rows and new local rows for persistence loading', () => {
    const legacyPublicRecord = createRecord();
    const localRecord = createRecord({
      runnableLevelKey: 'edited-builtin:exact-1',
      comparisonLevelKey: 'edited-builtin:fingerprint-1',
      levelName: 'Edited Builtin Variant',
      localMetadata: {
        levelRef: 'temp:edited-builtin',
        exactLevelKey: 'edited-builtin:exact-1',
        levelFingerprint: 'edited-builtin:exact-1',
        comparisonLevelKey: 'edited-builtin:fingerprint-1',
      },
    });

    expect(isPersistedBenchmarkRunRecord(legacyPublicRecord)).toBe(true);
    expect(isPersistedBenchmarkRunRecord(localRecord)).toBe(true);
  });

  it('tolerates missing optional session metadata on imported or older rows', () => {
    expect(
      isPersistedBenchmarkRunRecord(
        createRecord({
          levelName: 'Imported Legacy Result',
          localMetadata: undefined,
        }),
      ),
    ).toBe(true);
  });

  it('rejects malformed local metadata shapes', () => {
    expect(
      isPersistedBenchmarkRunRecord({
        ...createRecord(),
        localMetadata: {
          levelRef: 'temp:edited-builtin',
          exactLevelKey: 'edited-builtin:exact-1',
          unexpected: true,
        },
      }),
    ).toBe(false);
  });

  it('rejects non-object records, extra keys, and invalid display metadata', () => {
    expect(isPersistedBenchmarkRunRecord(null)).toBe(false);
    expect(isPersistedBenchmarkRunRecord([createRecord()])).toBe(false);
    expect(
      isPersistedBenchmarkRunRecord({
        ...createRecord(),
        unexpected: true,
      }),
    ).toBe(false);
    expect(
      isPersistedBenchmarkRunRecord({
        ...createRecord(),
        levelName: 42,
      }),
    ).toBe(false);
  });
});
