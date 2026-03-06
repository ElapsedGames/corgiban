import type { PersistencePort, PersistencePortInitResult } from '../../ports/persistencePort';
import { createNoopPersistencePort } from './persistenceMemory';

export type { PersistOutcome, RepositoryHealth } from '../../ports/persistencePort';
export {
  applyRetentionLimit,
  sortByCompletion,
  upsertMemoryResult,
  type RetentionResult,
} from './persistenceMemory';

export type BenchmarkStorageInitResult = PersistencePortInitResult;
export type BenchmarkStorage = PersistencePort;

export function createNoopBenchmarkStorage(): BenchmarkStorage {
  return createNoopPersistencePort();
}
