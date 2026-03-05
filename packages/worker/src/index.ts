export const workerVersion = '0.0.0';

export { PROTOCOL_VERSION } from './protocol/protocol';
export type {
  BenchProgressMessage,
  BenchResultMessage,
  BenchStartMessage,
  PingMessage,
  PongMessage,
  SolveErrorMessage,
  SolveProgressMessage,
  SolveResultMessage,
  SolveStartMessage,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './protocol/protocol';

export {
  parseWorkerInboundMessage,
  parseWorkerOutboundMessage,
  solverSchemas,
  workerInboundSchema,
  workerOutboundSchema,
} from './protocol/schema';
export {
  assertInboundMessage,
  assertOutboundMessage,
  ProtocolValidationError,
  validateInboundMessage,
  type OutboundValidationMode,
  type ValidateOutboundMessageOptions,
  validateOutboundMessage,
} from './protocol/validation';
export { WorkerPool } from './client/workerPool.client';
export { resolveBenchmarkWorkerPoolSize } from './client/workerPool.client';
export type { WorkerTask } from './client/workerPool.client';
export { createSolverClient } from './client/solverClient.client';
export type {
  CreateSolverClientOptions,
  SolverClient,
  SolverClientSolveRequest,
  SolverWorkerHealth,
} from './client/solverClient.client';
export { createBenchmarkClient } from './client/benchmarkClient.client';
export type {
  BenchmarkClient,
  BenchmarkClientRunCallbacks,
  BenchmarkClientRunRequest,
  BenchmarkClientSuiteRequest,
  CreateBenchmarkClientOptions,
} from './client/benchmarkClient.client';
