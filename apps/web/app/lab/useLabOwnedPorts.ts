import { useEffect, useLayoutEffect, useRef } from 'react';

import { createNoopBenchmarkPort, type BenchmarkPort } from '../ports/benchmarkPort';
import { createBenchmarkPort } from '../ports/benchmarkPort.client';
import { createNoopSolverPort, type SolverPort } from '../ports/solverPort';
import { createSolverPort } from '../ports/solverPort.client';
import type { RunToken } from './labTypes';

const useLabPortEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

type UseLabOwnedPortsOptions = {
  activeSolveRunRef: React.MutableRefObject<RunToken | null>;
  activeBenchRunRef: React.MutableRefObject<RunToken | null>;
};

export function useLabOwnedPorts({
  activeSolveRunRef,
  activeBenchRunRef,
}: UseLabOwnedPortsOptions) {
  const solverPortRef = useRef<SolverPort>();
  const benchmarkPortRef = useRef<BenchmarkPort>();

  useLabPortEffect(() => {
    const isServer = typeof document === 'undefined';
    const solverPort = isServer ? createNoopSolverPort() : createSolverPort();
    const benchmarkPort = isServer ? createNoopBenchmarkPort() : createBenchmarkPort();

    solverPortRef.current = solverPort;
    benchmarkPortRef.current = benchmarkPort;

    return () => {
      activeSolveRunRef.current = null;
      activeBenchRunRef.current = null;
      solverPort.dispose();
      benchmarkPort.dispose();
      if (solverPortRef.current === solverPort) {
        solverPortRef.current = undefined;
      }
      if (benchmarkPortRef.current === benchmarkPort) {
        benchmarkPortRef.current = undefined;
      }
    };
  }, [activeBenchRunRef, activeSolveRunRef]);

  return {
    solverPortRef,
    benchmarkPortRef,
  };
}
