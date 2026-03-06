# packages/worker

Worker runtime, protocol, validation, and main-thread clients.

## Responsibilities

- Versioned worker protocol and runtime validation (Zod schemas)
- Worker entrypoints for solver and benchmark runs
- Cancellation, solver-context-directed progress streaming, and crash recovery hooks
- Main-thread worker clients and worker-pool orchestration
- Best-effort solver-kernel preload hooks (TS baseline remains fallback)
- `workerHealth` state tracking for solver clients: `'idle' | 'healthy' | 'crashed'`

## Current status (Phase 6 integration)

- Implemented:
  - protocol message types and Zod schemas for `SOLVE_*` and `BENCH_*`
  - runtime validation helpers
  - solver worker runtime and client wrapper
  - benchmark worker runtime and benchmark client wrapper
  - worker pool queueing/cancel/dispose behavior
  - one-active-run solver-client guard and hard-reset cancel semantics for `/play`
  - solver ping timeout hardening: `ping(timeoutMs?)` defaults to `DEFAULT_PING_TIMEOUT_MS`,
    is idle-only, and transitions worker health to `crashed` with immediate worker termination on
    timeout/error
  - worker-runtime kernel preload (`preloadSolverKernels`) is best-effort; failed kernel loads do
    not block solve/bench execution
  - solver-kernel work in this phase is delivery/preload groundwork only; solve and bench still
    execute through the TS solver path
- `/play` cancellation baseline remains ADR-0013 (`cancel(runId)` resets the solver worker client)
- benchmark suite cancellation semantics follow ADR-0014 (queue cancel + suite dispose)
- solver-client ping liveness/timeout semantics follow ADR-0018 (idle-only ping, bounded timeout,
  crashed-on-timeout/error recovery)
- worker runtimes inject `performance.now()` into solver context only when a monotonic clock is
  available; they intentionally do not synthesize a `Date.now()` fallback and instead preserve the
  solver's explicit error contract

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

- `packages/shared`, `packages/core`, `packages/solver`, `packages/solver-kernels`, `packages/benchmarks`
- No `apps/web`, no React, no React Router, no Redux

## Hard constraints

- `SharedArrayBuffer` and `Atomics` are banned; coordination uses `postMessage` + protocol validation
- All run-scoped messages include `protocolVersion` and `runId`; lifecycle `PING`/`PONG` include `protocolVersion` only
- Protocol is validated at both ends using shared schemas in `src/protocol/schema.ts`
- Progress throttling is solver-owned (`solve(..., context)` throttle settings); worker runtime does
  not apply an additional throttle layer.
- Inbound `levelRuntime` validation enforces structural invariants:
  - `staticGrid.length === width * height`
  - player/box indices are in bounds
  - boxes are unique
  - player and boxes do not overlap
- Worker construction (`new Worker(...)`) is only allowed in `*.client.ts` modules
- Optional solver-kernel URLs are injected by app-owned client bootstraps through
  `globalThis.__corgibanSolverKernelUrls`; worker preload is best-effort and never replaces the TS
  fallback requirement
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
- `/play` in-flight cancellation is intentionally a hard reset contract in protocol v2:
  `createSolverClient.cancel(runId)` rejects the active run, terminates the worker, and recreates
  it. `SOLVE_CANCEL` is deferred until a future ADR changes the protocol/runtime model.
- `createSolverClient().ping(timeoutMs?)` is an idle-only liveness check and rejects while a
  `SOLVE_START` run is active
- `createSolverClient().solve(...)` rejects while a `PING` is in flight to avoid ping/solve
  interleaving ambiguity
- Benchmark-worker `BENCH_PROGRESS` is emitted only when `enableSpectatorStream` is true for the
  run request; app adapters should enable spectator stream only when they actively consume
  per-run worker progress
- Worker runtimes must not inject non-monotonic time sources into solver context. When
  `performance.now()` is unavailable, they leave `context.nowMs` unset so the solver can surface
  the explicit clock-unavailable error contract.

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
- `DEFAULT_PING_TIMEOUT_MS`
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
import {
  DEFAULT_PING_TIMEOUT_MS,
  createBenchmarkClient,
  createSolverClient,
} from '@corgiban/worker';

const solverClient = createSolverClient();
const benchmarkClient = createBenchmarkClient();

await solverClient.ping(); // idle-only, uses DEFAULT_PING_TIMEOUT_MS
await solverClient.ping(DEFAULT_PING_TIMEOUT_MS); // explicit default timeout
await solverClient.ping(2_000); // idle-only, custom timeout in ms

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
import './configureSolverKernelUrls.client';
import solverWorkerUrl from './solverWorker.client.ts?worker&url';
import benchmarkWorkerUrl from './benchmarkWorker.client.ts?worker&url';

const solverWorker = new Worker(solverWorkerUrl, { type: 'module', name: 'corgiban-solver' });
const benchmarkWorker = new Worker(benchmarkWorkerUrl, {
  type: 'module',
  name: 'corgiban-benchmark',
});
```

Optional kernel wiring for those app-owned bootstraps is env-driven:

- `VITE_SOLVER_KERNEL_REACHABILITY_URL`
- `VITE_SOLVER_KERNEL_HASHING_URL`
- `VITE_SOLVER_KERNEL_ASSIGNMENT_URL`

When present, `configureSolverKernelUrls.client.ts` normalizes them onto
`globalThis.__corgibanSolverKernelUrls` before runtime bootstrap. Worker preload deduplicates URLs
and ignores load failures so the TS baseline remains available. App bootstraps should pass only
absolute URLs or app-root-relative paths; other relative forms are rejected before worker runtime
bootstrap.

## Testing

- Protocol schema validation tests (valid and invalid messages, union discriminator coverage)
- Solver and benchmark runtime tests
- Solver and benchmark client tests
- Worker pool tests for queue cancel/dispose semantics and stale-callback race paths
- Review-sensitive contract coverage:
  - `src/client/__tests__/solverClient.test.ts` covers hard-reset cancel/recreate semantics.
  - `src/runtime/__tests__/solverWorker.test.ts` covers invalid `SOLVE_CANCEL` and missing
    monotonic-clock handling.
  - `src/runtime/__tests__/benchmarkWorker.test.ts` covers the same monotonic-clock contract for
    benchmark execution.
- Optional profiling workflow for validation-path decisions:
  `node tools/scripts/profile-worker-validation.mjs`
  (writes `docs/_generated/analysis/phase-04-protocol-validation-profile.md`)
