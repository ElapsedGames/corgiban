# packages/solver-kernels

Optional solver performance kernels.

## Responsibilities

- Provide TS baseline kernels for reachability, hashing, and assignment scoring.
- Provide lazy WASM loading hooks (`instantiateStreaming` with fallback).
- Keep deterministic behavior and stable TS interfaces.
- Allow app-owned worker bootstraps to opt into best-effort WASM preload without making WASM a
  required runtime dependency.

## Public API

Exports from `src/index.ts`:

- `solverKernelsVersion`
- `ReachabilityRequest`
- `ReachabilityResult`
- `reachabilityFloodFill(...)`
- `HashStateRequest`
- `hashState64(...)`
- `hashStatePair(...)`
- `AssignmentHeuristicRequest`
- `assignmentHeuristic(...)`
- `LoadWasmKernelOptions`
- `WasmKernelModule`
- `loadWasmKernel(...)`

## Usage example

```ts
import { hashStatePair, loadWasmKernel, reachabilityFloodFill } from '@corgiban/solver-kernels';

const reachable = reachabilityFloodFill({
  width: 5,
  height: 5,
  startIndex: 12,
  wallMask: new Uint8Array(25),
});

const hash = hashStatePair({ playerIndex: 12, boxIndices: [7, 17] });

const wasmModule = await loadWasmKernel('/kernels/reachability.wasm');
// wasmModule === null when fetch or WebAssembly support is unavailable
// HTTP fetch failures still reject; worker preload call sites intentionally swallow those errors.
```

## Delivery contract

- TS kernels are the required baseline and must remain correct without WASM.
- `apps/web` may provide optional kernel URLs through:
  - `VITE_SOLVER_KERNEL_REACHABILITY_URL`
  - `VITE_SOLVER_KERNEL_HASHING_URL`
  - `VITE_SOLVER_KERNEL_ASSIGNMENT_URL`
- App bootstraps should use absolute URLs or app-root-relative paths only; accepted values are
  normalized to absolute URLs before worker preload runs.
- Worker runtimes preload configured kernels best-effort and silently fall back to TS on failure.
- Phase 6 lands delivery/preload groundwork only; solve and bench execution still use the TS
  solver path until a later runtime-integration phase proves a measurable benefit.

## Allowed imports

- `@corgiban/shared`
- `@corgiban/core`
- `@corgiban/solver`

No UI or browser DOM dependencies.
