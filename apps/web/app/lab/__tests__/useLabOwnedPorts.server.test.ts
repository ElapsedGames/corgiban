// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BenchmarkPort } from '../../ports/benchmarkPort';
import type { SolverPort } from '../../ports/solverPort';
import type { RunToken } from '../labTypes';

const serverHookState = vi.hoisted(() => ({
  benchmarkPortRef: { current: undefined as unknown },
  cleanup: null as null | (() => void),
  refCallCount: 0,
  solverPortRef: { current: undefined as unknown },
  useLayoutEffect: vi.fn(),
}));

const portFactories = vi.hoisted(() => ({
  createBenchmarkPort: vi.fn(),
  createNoopBenchmarkPort: vi.fn(),
  createNoopSolverPort: vi.fn(),
  createSolverPort: vi.fn(),
}));

vi.mock('react', () => ({
  useEffect: (effect: () => void | (() => void)) => {
    serverHookState.cleanup = effect() ?? null;
  },
  useLayoutEffect: (...args: unknown[]) => {
    serverHookState.useLayoutEffect(...args);
    throw new Error('useLayoutEffect should not run for server-owned ports.');
  },
  useRef: <T>(_initialValue?: T) => {
    serverHookState.refCallCount += 1;
    if (serverHookState.refCallCount === 1) {
      return serverHookState.solverPortRef as { current: T | undefined };
    }

    return serverHookState.benchmarkPortRef as { current: T | undefined };
  },
}));

vi.mock('../../ports/solverPort.client', () => ({
  createSolverPort: portFactories.createSolverPort,
}));

vi.mock('../../ports/benchmarkPort.client', () => ({
  createBenchmarkPort: portFactories.createBenchmarkPort,
}));

vi.mock('../../ports/solverPort', () => ({
  createNoopSolverPort: portFactories.createNoopSolverPort,
}));

vi.mock('../../ports/benchmarkPort', () => ({
  createNoopBenchmarkPort: portFactories.createNoopBenchmarkPort,
}));

import { useLabOwnedPorts } from '../useLabOwnedPorts';

function createSolverPortStub(): SolverPort {
  return {
    startSolve: vi.fn(async () => {
      throw new Error('unused solver port');
    }),
    cancelSolve: vi.fn(),
    pingWorker: vi.fn(async () => undefined),
    retryWorker: vi.fn(),
    getWorkerHealth: vi.fn(() => 'healthy'),
    subscribeWorkerHealth: vi.fn(() => () => undefined),
    dispose: vi.fn(),
  };
}

function createBenchmarkPortStub(): BenchmarkPort {
  return {
    runSuite: vi.fn(async () => []),
    cancelSuite: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('useLabOwnedPorts server branch', () => {
  beforeEach(() => {
    portFactories.createSolverPort.mockReset();
    portFactories.createBenchmarkPort.mockReset();
    portFactories.createNoopSolverPort.mockReset();
    portFactories.createNoopBenchmarkPort.mockReset();
    serverHookState.benchmarkPortRef.current = undefined;
    serverHookState.cleanup = null;
    serverHookState.refCallCount = 0;
    serverHookState.solverPortRef.current = undefined;
    serverHookState.useLayoutEffect.mockReset();
  });

  it('uses noop ports and server-safe cleanup when the document is unavailable', () => {
    const solverPort = createSolverPortStub();
    const benchmarkPort = createBenchmarkPortStub();
    portFactories.createNoopSolverPort.mockReturnValue(solverPort);
    portFactories.createNoopBenchmarkPort.mockReturnValue(benchmarkPort);

    const activeSolveRunRef: { current: RunToken | null } = {
      current: { runId: 'solve-1', authoredRevision: 3 },
    };
    const activeBenchRunRef: { current: RunToken | null } = {
      current: { runId: 'bench-1', authoredRevision: 4 },
    };

    const result = useLabOwnedPorts({ activeSolveRunRef, activeBenchRunRef });

    expect(portFactories.createNoopSolverPort).toHaveBeenCalledTimes(1);
    expect(portFactories.createNoopBenchmarkPort).toHaveBeenCalledTimes(1);
    expect(portFactories.createSolverPort).not.toHaveBeenCalled();
    expect(portFactories.createBenchmarkPort).not.toHaveBeenCalled();
    expect(serverHookState.useLayoutEffect).not.toHaveBeenCalled();
    expect(result.solverPortRef.current).toBe(solverPort);
    expect(result.benchmarkPortRef.current).toBe(benchmarkPort);

    serverHookState.cleanup?.();

    expect(activeSolveRunRef.current).toBeNull();
    expect(activeBenchRunRef.current).toBeNull();
    expect(solverPort.dispose).toHaveBeenCalledTimes(1);
    expect(benchmarkPort.dispose).toHaveBeenCalledTimes(1);
    expect(result.solverPortRef.current).toBeUndefined();
    expect(result.benchmarkPortRef.current).toBeUndefined();
  });
});
