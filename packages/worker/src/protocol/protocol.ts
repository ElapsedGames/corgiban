import type { LevelRuntime } from '@corgiban/core';
import type { AlgorithmId, SolveStatus, SolverMetrics, SolverOptions } from '@corgiban/solver';

export type ProtocolVersion = 1;

export type SolveStartMessage = {
  type: 'SOLVE_START';
  runId: string;
  protocolVersion: ProtocolVersion;
  levelRuntime: LevelRuntime;
  algorithmId: AlgorithmId;
  options?: SolverOptions;
};

export type SolveCancelMessage = {
  type: 'SOLVE_CANCEL';
  runId: string;
  protocolVersion: ProtocolVersion;
};

export type SolveProgressMessage = {
  type: 'SOLVE_PROGRESS';
  runId: string;
  protocolVersion: ProtocolVersion;
  expanded: number;
  generated: number;
  depth: number;
  frontier: number;
  elapsedMs: number;
  bestHeuristic?: number;
  bestPathSoFar?: string;
};

export type SolveResultMessage = {
  type: 'SOLVE_RESULT';
  runId: string;
  protocolVersion: ProtocolVersion;
  status: SolveStatus;
  solutionMoves?: string;
  metrics: SolverMetrics;
};

export type SolveErrorMessage = {
  type: 'SOLVE_ERROR';
  runId: string;
  protocolVersion: ProtocolVersion;
  message: string;
  details?: string;
};

export type PingMessage = {
  type: 'PING';
  protocolVersion: ProtocolVersion;
};

export type PongMessage = {
  type: 'PONG';
  protocolVersion: ProtocolVersion;
};

// TODO(Phase 4): add BENCH_START to WorkerInboundMessage.
export type WorkerInboundMessage = SolveStartMessage | SolveCancelMessage | PingMessage;

export type WorkerOutboundMessage =
  | SolveProgressMessage
  | SolveResultMessage
  | SolveErrorMessage
  | PongMessage;
// TODO(Phase 4): add BENCH_PROGRESS and BENCH_RESULT to WorkerOutboundMessage.

export const PROTOCOL_VERSION: ProtocolVersion = 1;
