import type { LevelRuntime } from '@corgiban/core';

import type { CompiledLevel } from '../state/compiledLevel';
import type { ZobristTable } from '../infra/zobrist';
import type { CancelToken } from '../infra/cancelToken';
import type { NormalizedSolverOptions } from './solverOptions';
import type { AlgorithmId, SolveResult, SolverHooks } from './solverTypes';

export type SolveContext = {
  nowMs?: () => number;
  cancelToken?: CancelToken;
  progressThrottleMs?: number;
  progressExpandedInterval?: number;
};

export type AlgorithmInput = {
  level: LevelRuntime;
  compiled: CompiledLevel;
  zobrist: ZobristTable;
  options: NormalizedSolverOptions;
  hooks?: SolverHooks;
  context: SolveContext;
};

export type SolverAlgorithm = {
  id: AlgorithmId;
  solve: (input: AlgorithmInput) => SolveResult;
};
