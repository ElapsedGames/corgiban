import { describe, expect, it } from 'vitest';

import {
  BENCHMARK_DB_INDEXES,
  BENCHMARK_DB_VERSION,
  BENCHMARK_DB_STORES,
} from '@corgiban/benchmarks';

import { migrateBenchmarkDatabase } from '../benchmarkRepository.client';

type MutableDomStringList = DOMStringList & {
  add: (value: string) => void;
  toArray: () => string[];
};

type FakeObjectStore = IDBObjectStore & {
  createdIndexes: string[];
};

function createDomStringList(initialValues: string[] = []): MutableDomStringList {
  const values = [...initialValues];

  return {
    contains(name: string) {
      return values.includes(name);
    },
    item(index: number) {
      return values[index] ?? null;
    },
    get length() {
      return values.length;
    },
    [Symbol.iterator]: function* iterator() {
      yield* values;
    },
    add(value: string) {
      if (!values.includes(value)) {
        values.push(value);
      }
    },
    toArray() {
      return [...values];
    },
  } as unknown as MutableDomStringList;
}

function createFakeObjectStore(existingIndexes: string[] = []): FakeObjectStore {
  const indexNames = createDomStringList(existingIndexes);
  const createdIndexes: string[] = [];

  return {
    indexNames,
    createIndex(name: string) {
      createdIndexes.push(name);
      indexNames.add(name);
      return {} as IDBIndex;
    },
    createdIndexes,
  } as unknown as FakeObjectStore;
}

function createMigrationHarness(existingStore?: FakeObjectStore) {
  const stores = new Map<string, FakeObjectStore>();
  if (existingStore) {
    stores.set(BENCHMARK_DB_STORES.runs, existingStore);
  }

  const objectStoreNames = createDomStringList(existingStore ? [BENCHMARK_DB_STORES.runs] : []);

  const database = {
    objectStoreNames,
    createObjectStore(name: string) {
      const store = createFakeObjectStore();
      stores.set(name, store);
      objectStoreNames.add(name);
      return store;
    },
  } as unknown as IDBDatabase;

  const transaction = {
    objectStore(name: string) {
      const store = stores.get(name);
      if (!store) {
        throw new Error(`Unknown store: ${name}`);
      }
      return store;
    },
  } as unknown as IDBTransaction;

  return {
    database,
    transaction,
    stores,
    objectStoreNames,
  };
}

describe('benchmarkRepository migrations', () => {
  it('creates the benchmark runs store and indexes for fresh installs', () => {
    const harness = createMigrationHarness();

    migrateBenchmarkDatabase({
      database: harness.database,
      transaction: null,
      oldVersion: 0,
    });

    expect(harness.objectStoreNames.contains(BENCHMARK_DB_STORES.runs)).toBe(true);

    const store = harness.stores.get(BENCHMARK_DB_STORES.runs);
    expect(store).toBeDefined();
    expect(store?.indexNames.contains(BENCHMARK_DB_INDEXES.runsBySuiteRunId)).toBe(true);
    expect(store?.indexNames.contains(BENCHMARK_DB_INDEXES.runsByFinishedAtMs)).toBe(true);
  });

  it('adds missing indexes when upgrading from version 1', () => {
    const existingStore = createFakeObjectStore();
    const harness = createMigrationHarness(existingStore);

    migrateBenchmarkDatabase({
      database: harness.database,
      transaction: harness.transaction,
      oldVersion: 1,
    });

    expect(existingStore.indexNames.contains(BENCHMARK_DB_INDEXES.runsBySuiteRunId)).toBe(true);
    expect(existingStore.indexNames.contains(BENCHMARK_DB_INDEXES.runsByFinishedAtMs)).toBe(true);
    expect(existingStore.createdIndexes).toEqual([
      BENCHMARK_DB_INDEXES.runsBySuiteRunId,
      BENCHMARK_DB_INDEXES.runsByFinishedAtMs,
    ]);
  });

  it('keeps existing indexes unchanged on repeated upgrades', () => {
    const existingStore = createFakeObjectStore([
      BENCHMARK_DB_INDEXES.runsBySuiteRunId,
      BENCHMARK_DB_INDEXES.runsByFinishedAtMs,
    ]);
    const harness = createMigrationHarness(existingStore);

    migrateBenchmarkDatabase({
      database: harness.database,
      transaction: harness.transaction,
      oldVersion: 1,
    });

    const indexNames = existingStore.indexNames as MutableDomStringList;
    expect(existingStore.createdIndexes).toEqual([]);
    expect(indexNames.toArray().sort()).toEqual(
      [BENCHMARK_DB_INDEXES.runsByFinishedAtMs, BENCHMARK_DB_INDEXES.runsBySuiteRunId].sort(),
    );
  });

  it('throws when upgrading an existing store without a migration transaction', () => {
    const existingStore = createFakeObjectStore();
    const harness = createMigrationHarness(existingStore);

    expect(() =>
      migrateBenchmarkDatabase({
        database: harness.database,
        transaction: null,
        oldVersion: 1,
      }),
    ).toThrow('migration transaction is required');
  });

  it('does nothing when oldVersion already matches current DB version', () => {
    const existingStore = createFakeObjectStore([
      BENCHMARK_DB_INDEXES.runsBySuiteRunId,
      BENCHMARK_DB_INDEXES.runsByFinishedAtMs,
    ]);
    const harness = createMigrationHarness(existingStore);

    migrateBenchmarkDatabase({
      database: harness.database,
      transaction: harness.transaction,
      oldVersion: BENCHMARK_DB_VERSION,
    });

    expect(existingStore.createdIndexes).toEqual([]);
  });
});
