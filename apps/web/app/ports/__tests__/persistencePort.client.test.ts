import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createBenchmarkStorage: vi.fn(),
}));

vi.mock('../../infra/persistence/benchmarkStorage.client', () => ({
  createBenchmarkStorage: mocks.createBenchmarkStorage,
}));

import { createPersistencePort } from '../persistencePort.client';

describe('createPersistencePort', () => {
  it('forwards explicit options to benchmark storage creation', () => {
    const storage = { init: vi.fn() };
    mocks.createBenchmarkStorage.mockReturnValueOnce(storage);

    const options = { isDev: true };
    const result = createPersistencePort(options);

    expect(mocks.createBenchmarkStorage).toHaveBeenCalledWith(options);
    expect(result).toBe(storage);
  });

  it('uses an empty options object when none are provided', () => {
    const storage = { init: vi.fn() };
    mocks.createBenchmarkStorage.mockReturnValueOnce(storage);

    const result = createPersistencePort();

    expect(mocks.createBenchmarkStorage).toHaveBeenCalledWith({});
    expect(result).toBe(storage);
  });
});
