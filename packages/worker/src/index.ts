export const workerVersion = '0.0.0';

export { PROTOCOL_VERSION } from './protocol/protocol';
export type {
  PingMessage,
  PongMessage,
  SolveCancelMessage,
  SolveErrorMessage,
  SolveProgressMessage,
  SolveResultMessage,
  SolveStartMessage,
  WorkerInboundMessage,
  WorkerOutboundMessage,
} from './protocol/protocol';

export { solverSchemas, workerInboundSchema, workerOutboundSchema } from './protocol/schema';
export { WorkerPool } from './client/workerPool.client';
export type { WorkerTask } from './client/workerPool.client';
