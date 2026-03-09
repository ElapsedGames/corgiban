// @vitest-environment jsdom

import { act, type MutableRefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BenchmarkPort } from '../../ports/benchmarkPort';
import type { SolverPort } from '../../ports/solverPort';
import type { RunToken } from '../labTypes';

const portFactories = vi.hoisted(() => ({
  createSolverPort: vi.fn(),
  createBenchmarkPort: vi.fn(),
  createNoopSolverPort: vi.fn(),
  createNoopBenchmarkPort: vi.fn(),
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

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];
const capturedRefs: {
  current: ReturnType<typeof useLabOwnedPorts> | null;
} = { current: null };

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

function Harness({
  activeSolveRunRef,
  activeBenchRunRef,
}: {
  activeSolveRunRef: MutableRefObject<RunToken | null>;
  activeBenchRunRef: MutableRefObject<RunToken | null>;
}) {
  capturedRefs.current = useLabOwnedPorts({ activeSolveRunRef, activeBenchRunRef });
  return null;
}

async function renderHarness({
  activeSolveRunRef = { current: null } as MutableRefObject<RunToken | null>,
  activeBenchRunRef = { current: null } as MutableRefObject<RunToken | null>,
} = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(
      <Harness activeSolveRunRef={activeSolveRunRef} activeBenchRunRef={activeBenchRunRef} />,
    );
  });

  return { root, activeSolveRunRef, activeBenchRunRef };
}

describe('useLabOwnedPorts', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    capturedRefs.current = null;

    portFactories.createSolverPort.mockReset();
    portFactories.createBenchmarkPort.mockReset();
    portFactories.createNoopSolverPort.mockReset();
    portFactories.createNoopBenchmarkPort.mockReset();

    portFactories.createSolverPort.mockImplementation(() => createSolverPortStub());
    portFactories.createBenchmarkPort.mockImplementation(() => createBenchmarkPortStub());
    portFactories.createNoopSolverPort.mockImplementation(() => createSolverPortStub());
    portFactories.createNoopBenchmarkPort.mockImplementation(() => createBenchmarkPortStub());
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('creates browser-backed ports on mount when the document is available', async () => {
    await renderHarness();

    expect(portFactories.createSolverPort).toHaveBeenCalledTimes(1);
    expect(portFactories.createBenchmarkPort).toHaveBeenCalledTimes(1);
    expect(portFactories.createNoopSolverPort).not.toHaveBeenCalled();
    expect(portFactories.createNoopBenchmarkPort).not.toHaveBeenCalled();
  });

  it('stores the created ports in the returned refs after mount', async () => {
    await renderHarness();

    const createdSolverPort = portFactories.createSolverPort.mock.results[0]?.value as SolverPort;
    const createdBenchmarkPort = portFactories.createBenchmarkPort.mock.results[0]
      ?.value as BenchmarkPort;

    expect(capturedRefs.current?.solverPortRef.current).toBe(createdSolverPort);
    expect(capturedRefs.current?.benchmarkPortRef.current).toBe(createdBenchmarkPort);
  });

  it('disposes both owned ports on unmount', async () => {
    const { root } = await renderHarness();
    const createdSolverPort = portFactories.createSolverPort.mock.results[0]?.value as SolverPort;
    const createdBenchmarkPort = portFactories.createBenchmarkPort.mock.results[0]
      ?.value as BenchmarkPort;

    await act(async () => {
      root.unmount();
    });

    expect(createdSolverPort.dispose).toHaveBeenCalledTimes(1);
    expect(createdBenchmarkPort.dispose).toHaveBeenCalledTimes(1);
  });

  it('clears active run tokens on unmount', async () => {
    const activeSolveRunRef: MutableRefObject<RunToken | null> = {
      current: { runId: 'solve-1', authoredRevision: 3 },
    };
    const activeBenchRunRef: MutableRefObject<RunToken | null> = {
      current: { runId: 'bench-1', authoredRevision: 4 },
    };

    const { root } = await renderHarness({ activeSolveRunRef, activeBenchRunRef });

    await act(async () => {
      root.unmount();
    });

    expect(activeSolveRunRef.current).toBeNull();
    expect(activeBenchRunRef.current).toBeNull();
  });

  it('clears owned refs when cleanup still controls them', async () => {
    const { root } = await renderHarness();

    await act(async () => {
      root.unmount();
    });

    expect(capturedRefs.current?.solverPortRef.current).toBeUndefined();
    expect(capturedRefs.current?.benchmarkPortRef.current).toBeUndefined();
  });

  it('preserves externally replaced refs during cleanup', async () => {
    const { root } = await renderHarness();
    const replacementSolverPort = createSolverPortStub();
    const replacementBenchmarkPort = createBenchmarkPortStub();

    if (!capturedRefs.current) {
      throw new Error('Hook refs were not captured.');
    }

    capturedRefs.current.solverPortRef.current = replacementSolverPort;
    capturedRefs.current.benchmarkPortRef.current = replacementBenchmarkPort;

    await act(async () => {
      root.unmount();
    });

    expect(capturedRefs.current.solverPortRef.current).toBe(replacementSolverPort);
    expect(capturedRefs.current.benchmarkPortRef.current).toBe(replacementBenchmarkPort);
  });

  it('creates fresh client ports for each mount', async () => {
    portFactories.createSolverPort
      .mockReset()
      .mockImplementationOnce(() => createSolverPortStub())
      .mockImplementationOnce(() => createSolverPortStub());
    portFactories.createBenchmarkPort
      .mockReset()
      .mockImplementationOnce(() => createBenchmarkPortStub())
      .mockImplementationOnce(() => createBenchmarkPortStub());

    const firstMount = await renderHarness();
    const firstSolverPort = capturedRefs.current?.solverPortRef.current;
    const firstBenchmarkPort = capturedRefs.current?.benchmarkPortRef.current;

    await act(async () => {
      firstMount.root.unmount();
    });

    await renderHarness();

    expect(capturedRefs.current?.solverPortRef.current).not.toBe(firstSolverPort);
    expect(capturedRefs.current?.benchmarkPortRef.current).not.toBe(firstBenchmarkPort);
    expect(portFactories.createSolverPort).toHaveBeenCalledTimes(2);
    expect(portFactories.createBenchmarkPort).toHaveBeenCalledTimes(2);
  });
});
