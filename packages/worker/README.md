# packages/worker

Worker runtime, protocol, validation, and main-thread clients.

## Responsibilities

- Versioned worker protocol and runtime validation (Zod schemas)
- Worker entrypoints for solver and benchmarks
- Cancellation, throttled progress streaming, and crash recovery hooks
- Main-thread worker client(s) and optional worker pool
- `workerHealth` state tracking: `'idle' | 'healthy' | 'crashed'`

## Allowed imports

- `packages/shared`, `packages/core`, `packages/solver`, `packages/benchmarks`
- No `apps/web`, no React, no React Router, no Redux

## Hard constraints

- **`SharedArrayBuffer` and `Atomics` are banned** - all coordination uses `postMessage` and the versioned protocol
- All messages (both directions) must include `protocolVersion` and `runId`
- Protocol is validated at both ends using shared Zod schemas in `src/protocol/schema.ts`; unknown fields and version mismatches are rejected
- Progress messages must be throttled (target: <= 10-20 messages/sec)
- Cancellation must be responsive and release resources without leaving the UI hanging
- Worker construction (`new Worker(...)`) is only allowed in `*.client.ts` modules

## Client module naming

Files in `src/client/` that construct workers must use the `*.client.ts` suffix.
This is enforced by ESLint and prevents worker code from executing in Remix server contexts.

## Testing

- Protocol schema validation tests (valid and invalid messages)
- Cancellation and failure recovery tests (deterministic simulation, no sleep)
- Throttle behavior tests (fake timers)
- `workerHealth` transition tests: `onerror` and `onmessageerror` -> `'crashed'`; retry -> `'idle'`
