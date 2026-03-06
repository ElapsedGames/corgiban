import { createBenchmarkStorage } from '../infra/persistence/benchmarkStorage.client';

import type { PersistencePort } from './persistencePort';

export type CreatePersistencePortOptions = Parameters<typeof createBenchmarkStorage>[0];

export function createPersistencePort(options: CreatePersistencePortOptions = {}): PersistencePort {
  return createBenchmarkStorage(options);
}
