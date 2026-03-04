# packages/worker

Worker runtime, protocol, validation, and main-thread clients.

## Responsibilities

- Versioned worker protocol and runtime validation (Zod schemas)
- Worker entrypoints for solver (benchmark runtime is planned)
- Cancellation, throttled progress streaming, and crash recovery hooks
- Main-thread worker client(s) and optional worker pool
- `workerHealth` state tracking: `'idle' | 'healthy' | 'crashed'`
- Solver protocol metrics include pushCount and moveCount, plus optional bestPathSoFar for spectator streams

## Current status (Phase 3 complete for solver runtime)

- Implemented: protocol message types and Zod schemas, runtime validation helpers, solver worker entrypoint, solver client wrapper, progress throttling, worker health tracking, and worker pool client.
- Pending: benchmark runtime entrypoints and benchmark client wiring.
- Phase 3 `createSolverClient()` is single-active-run oriented for `/play`; use `WorkerPool` for concurrent solves.

## Protocol v2 baseline (current implementation)

Inbound:

- `SOLVE_START`
- `PING`

Outbound:

- `SOLVE_PROGRESS`
- `SOLVE_RESULT`
- `SOLVE_ERROR`
- `PONG`

Deferred to a later protocol extension:

- `SOLVE_CANCEL`
- benchmark messages (`BENCH_START`, `BENCH_PROGRESS`, `BENCH_RESULT`)

In-flight cancellation in Phase 3 is handled by solver-client worker reset (`terminate` + recreate).

## Allowed imports

- `packages/shared`, `packages/core`, `packages/solver`, `packages/benchmarks`
- No `apps/web`, no React, no React Router, no Redux

## Hard constraints

- **`SharedArrayBuffer` and `Atomics` are banned** - all coordination uses `postMessage` and the versioned protocol
- All run-scoped messages must include `protocolVersion` and `runId`; lifecycle `PING`/`PONG` include `protocolVersion` only
- Protocol is validated at both ends using shared Zod schemas in `src/protocol/schema.ts`; unknown fields and version mismatches are rejected
- Progress messages must be throttled (target: <= 10-20 messages/sec)
- Cancellation must be responsive and release resources without leaving the UI hanging
- Worker construction (`new Worker(...)`) is only allowed in `*.client.ts` modules
- Worker pool runs one active solve per worker and queues additional runs
- Worker pool supports cancelling queued runs by `runId` (in-flight cancellation in solver client performs a hard worker reset)
- `createSolverClient.cancel(runId)` resets the worker and rejects all pending runs/pings for that client instance (Phase 3 baseline)
- Worker pool dispose rejects queued and in-flight tasks without waiting for running tasks to settle
- When provided, the worker pool disposer callback is responsible for terminating workers
- Typed arrays in protocol payloads are validated via `instanceof` and are expected to arrive through structured-clone `postMessage`; revisit this validation strategy if alternate transports/runtimes are introduced.

## Public API surface

Primary API exports come from `src/index.ts`.

Runtime exports:

- `workerVersion`
- `PROTOCOL_VERSION`
- `parseWorkerInboundMessage`, `parseWorkerOutboundMessage`
- `workerInboundSchema`, `workerOutboundSchema`, `solverSchemas`
- `validateInboundMessage`, `validateOutboundMessage`
- `assertInboundMessage`, `assertOutboundMessage`
- `ProtocolValidationError`
- `createSolverClient(...)`
- `WorkerPool`

Type exports include:

- Protocol messages (`SolveStartMessage`, `SolveProgressMessage`, `SolveResultMessage`, `SolveErrorMessage`, `PingMessage`, `PongMessage`, `WorkerInboundMessage`, `WorkerOutboundMessage`)
- Solver client contracts (`SolverClient`, `SolverClientSolveRequest`, `SolverWorkerHealth`, `CreateSolverClientOptions`)
- `WorkerTask`

Additional package subpath export:

- `@corgiban/worker/runtime/solverWorker` (worker runtime bootstrap entry for app adapters)

## Usage example

```ts
import { createSolverClient } from '@corgiban/worker';

const client = createSolverClient();
const result = await client.solve({
  runId: 'solve-1',
  levelRuntime,
  algorithmId: 'bfsPush',
});
```

## Remix/Vite adapter pattern

For `apps/web`, use an app-owned worker adapter so Remix/Vite can bundle the worker asset:

```ts
import solverWorkerUrl from './solverWorker.client.ts?worker&url';

const worker = new Worker(solverWorkerUrl, { type: 'module', name: 'corgiban-solver' });
```

The adapter module (`solverWorker.client.ts`) should import the runtime entry:
`@corgiban/worker/runtime/solverWorker`.

## Client module naming

Files in `src/client/` that construct workers must use the `*.client.ts` suffix.
This is enforced by ESLint and prevents worker code from executing in Remix server contexts.

## Testing

- Protocol schema validation tests (valid and invalid messages)
- Cancellation and failure recovery tests (deterministic simulation, no sleep)
- Throttle behavior tests (fake timers)
- `workerHealth` transition tests: `onerror` and `onmessageerror` -> `'crashed'`; retry -> `'idle'`
