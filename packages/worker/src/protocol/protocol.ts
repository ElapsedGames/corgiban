import type { LevelRuntime } from '@corgiban/core';
import type { AlgorithmId, SolveStatus, SolverMetrics, SolverOptions } from '@corgiban/solver';

export type ProtocolVersion = 2;

export type SolveStartMessage = {
  type: 'SOLVE_START';
  runId: string;
  protocolVersion: ProtocolVersion;
  levelRuntime: LevelRuntime;
  algorithmId: AlgorithmId;
  options?: SolverOptions;
};

export type BenchStartMessage = {
  type: 'BENCH_START';
  runId: string;
  protocolVersion: ProtocolVersion;
  levelRuntime: LevelRuntime;
  algorithmId: AlgorithmId;
  options?: SolverOptions;
  benchmarkCaseId?: string;
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

export type BenchProgressMessage = {
  type: 'BENCH_PROGRESS';
  runId: string;
  protocolVersion: ProtocolVersion;
  expanded: number;
  generated: number;
  depth: number;
  frontier: number;
  elapsedMs: number;
  bestHeuristic?: number;
  bestPathSoFar?: string;
  benchmarkCaseId?: string;
};

type SolveResultBaseMessage = {
  type: 'SOLVE_RESULT';
  runId: string;
  protocolVersion: ProtocolVersion;
  metrics: SolverMetrics;
};

type SolveResultErrorMessage = SolveResultBaseMessage & {
  status: 'error';
  errorMessage: string;
  errorDetails?: string;
};

type SolveResultNonErrorMessage = SolveResultBaseMessage & {
  status: Exclude<SolveStatus, 'error'>;
  solutionMoves?: string;
};

export type SolveResultMessage = SolveResultErrorMessage | SolveResultNonErrorMessage;

type BenchResultBaseMessage = {
  type: 'BENCH_RESULT';
  runId: string;
  protocolVersion: ProtocolVersion;
  metrics: SolverMetrics;
  benchmarkCaseId?: string;
};

type BenchResultErrorMessage = BenchResultBaseMessage & {
  status: 'error';
  errorMessage: string;
  errorDetails?: string;
};

type BenchResultNonErrorMessage = BenchResultBaseMessage & {
  status: Exclude<SolveStatus, 'error'>;
  solutionMoves?: string;
};

export type BenchResultMessage = BenchResultErrorMessage | BenchResultNonErrorMessage;

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

export type WorkerInboundMessage = SolveStartMessage | BenchStartMessage | PingMessage;

export type WorkerOutboundMessage =
  | SolveProgressMessage
  | BenchProgressMessage
  | SolveResultMessage
  | BenchResultMessage
  | SolveErrorMessage
  | PongMessage;

export const PROTOCOL_VERSION: ProtocolVersion = 2;
