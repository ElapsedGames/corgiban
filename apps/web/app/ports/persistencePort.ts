import type { BenchmarkRunRecord } from '@corgiban/benchmarks';

export type PersistOutcome = 'granted' | 'denied' | 'unsupported';

export type PersistencePortInitResult = {
  persistOutcome: PersistOutcome;
};

export type PersistencePort = {
  init: (options?: { debug?: boolean }) => Promise<PersistencePortInitResult>;
  loadResults: () => Promise<BenchmarkRunRecord[]>;
  saveResult: (result: BenchmarkRunRecord) => Promise<void>;
  replaceResults: (results: BenchmarkRunRecord[]) => Promise<void>;
  clearResults: () => Promise<void>;
  dispose: () => void;
};
