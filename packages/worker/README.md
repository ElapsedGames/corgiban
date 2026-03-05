# packages/worker

Worker runtime, protocol, validation, and main-thread clients.

## Responsibilities

- Versioned worker protocol and runtime validation (Zod schemas)
- Worker entrypoints for solver and benchmark runs
- Cancellation, throttled progress streaming, and crash recovery hooks
- Main-thread worker clients and worker-pool orchestration
- `workerHealth` state tracking for solver clients: `'idle' | 'healthy' | 'crashed'`

## Current status (Phase 4 benchmark + solver runtime)

- Implemented:
  - protocol message types and Zod schemas for `SOLVE_*` and `BENCH_*`
  - runtime validation helpers
  - solver worker runtime and client wrapper
  - benchmark worker runtime and benchmark client wrapper
  - worker pool queueing/cancel/dispose behavior
  - one-active-run solver-client guard and hard-reset cancel semantics for `/play`
- `/play` cancellation baseline remains ADR-0013 (`cancel(runId)` resets the solver worker client)
- benchmark suite cancellation semantics follow ADR-0014 (queue cancel + suite dispose)

## Protocol v2 baseline (current implementation)

Inbound:

- `SOLVE_START`
- `BENCH_START`
- `PING`

Outbound:

- `SOLVE_PROGRESS`
- `BENCH_PROGRESS`
- `SOLVE_RESULT`
- `BENCH_RESULT`
- `SOLVE_ERROR`
- `PONG`

Deferred to a later protocol extension:

- `SOLVE_CANCEL`
- `BENCH_CANCEL`

## Allowed imports

- `packages/shared`, `packages/core`, `packages/solver`, `packages/benchmarks`
- No `apps/web`, no React, no React Router, no Redux

## Hard constraints

- `SharedArrayBuffer` and `Atomics` are banned; coordination uses `postMessage` + protocol validation
- All run-scoped messages include `protocolVersion` and `runId`; lifecycle `PING`/`PONG` include `protocolVersion` only
- Protocol is validated at both ends using shared schemas in `src/protocol/schema.ts`
- Inbound `levelRuntime` validation enforces structural invariants:
  - `staticGrid.length === width * height`
  - player/box indices are in bounds
  - boxes are unique
  - player and boxes do not overlap
- Worker construction (`new Worker(...)`) is only allowed in `*.client.ts` modules
- `WorkerPool` runs one active task per worker and queues additional runs
- `WorkerPool.cancel(runId)` cancels queued runs only
- `WorkerPool.dispose()` rejects queued and in-flight tasks; worker cleanup is performed via an
  optional disposer callback
- Typed-array payload fields are validated via `instanceof` and expected over structured-clone `postMessage`
- Outbound validation supports an optional scoped `light-progress` mode for hot
  `SOLVE_PROGRESS` paths; strict validation remains the default and structural messages stay
  strict-schema validated
- `createSolverClient({ outboundValidationMode: 'light-progress' })` enables light validation for
  `SOLVE_PROGRESS` only; all other outbound messages remain strict-schema validated
- Benchmark-worker `BENCH_PROGRESS` is emitted only when `enableSpectatorStream` is true for the
  run request; app adapters should enable spectator stream only when they actively consume
  per-run worker progress

## Public API surface

Primary API exports come from `src/index.ts`.

Runtime exports:

- `workerVersion`
- `PROTOCOL_VERSION`
- protocol message types (`SolveStartMessage`, `BenchStartMessage`, `WorkerInboundMessage`, etc.)
- `parseWorkerInboundMessage`, `parseWorkerOutboundMessage`
- `workerInboundSchema`, `workerOutboundSchema`, `solverSchemas`
- `validateInboundMessage`, `validateOutboundMessage`
- `OutboundValidationMode`, `ValidateOutboundMessageOptions`
- `assertInboundMessage`, `assertOutboundMessage`
- `ProtocolValidationError`
- `createSolverClient(...)`
- `createBenchmarkClient(...)`
- `WorkerPool`
- `resolveBenchmarkWorkerPoolSize(...)`

Type exports include:

- solver-client contracts (`SolverClient`, `CreateSolverClientOptions`, `SolverWorkerHealth`, etc.)
- benchmark-client contracts (`BenchmarkClient`, `BenchmarkClientSuiteRequest`, `BenchmarkClientRunRequest`, etc.)
- `WorkerTask`

Additional package subpath exports:

- `@corgiban/worker/runtime/solverWorker`
- `@corgiban/worker/runtime/benchmarkWorker`

## Usage example

```ts
import { createBenchmarkClient, createSolverClient } from '@corgiban/worker';

const solverClient = createSolverClient();
const benchmarkClient = createBenchmarkClient();

await solverClient.solve({
  runId: 'solve-1',
  levelRuntime,
  algorithmId: 'bfsPush',
  options: { timeBudgetMs: 30_000, nodeBudget: 2_000_000 },
});

await benchmarkClient.runSuite({
  runs: [
    {
      runId: 'bench-1',
      levelRuntime,
      algorithmId: 'bfsPush',
      options: { timeBudgetMs: 30_000, nodeBudget: 2_000_000 },
    },
  ],
});
```

## Remix/Vite adapter pattern

For `apps/web`, use app-owned worker adapters so Remix/Vite can bundle worker assets:

```ts
import solverWorkerUrl from './solverWorker.client.ts?worker&url';
import benchmarkWorkerUrl from './benchmarkWorker.client.ts?worker&url';

const solverWorker = new Worker(solverWorkerUrl, { type: 'module', name: 'corgiban-solver' });
const benchmarkWorker = new Worker(benchmarkWorkerUrl, {
  type: 'module',
  name: 'corgiban-benchmark',
});
```

## Testing

- Protocol schema validation tests (valid and invalid messages, union discriminator coverage)
- Solver and benchmark runtime tests
- Solver and benchmark client tests
- Worker pool tests for queue cancel/dispose semantics and stale-callback race paths
- Optional profiling workflow for validation-path decisions:
  `node tools/scripts/profile-worker-validation.mjs`
  (writes `docs/_generated/analysis/phase-04-protocol-validation-profile.md`)
