# ADR 0021: Solver kernel delivery and best-effort worker preload contract

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

Phase 6 activates `packages/solver-kernels` and keeps TS implementations as the required baseline
while allowing optional WASM kernels to load inside workers. The worker package must stay
framework-agnostic and cannot depend on Remix/Vite-specific asset handling, but the app layer owns
bundle-time URL resolution for optional WASM artifacts.

We need a stable delivery contract that keeps:

- `packages/worker` independent from app bundlers
- optional WASM usage out of the worker protocol
- TS kernels available when WASM URLs are absent or fail to load

## Decision

- `packages/solver-kernels` remains TS-first; WASM artifacts are optional accelerators.
- `apps/web` owns optional kernel URL wiring in client bootstrap modules.
  - `configureSolverKernelUrls.client.ts` reads:
    - `VITE_SOLVER_KERNEL_REACHABILITY_URL`
    - `VITE_SOLVER_KERNEL_HASHING_URL`
    - `VITE_SOLVER_KERNEL_ASSIGNMENT_URL`
  - when present, it accepts only absolute URLs or app-root-relative paths (`/kernels/foo.wasm`);
    accepted values are normalized to absolute URLs before writing
    `globalThis.__corgibanSolverKernelUrls`, and other relative forms are rejected
    before importing `@corgiban/worker/runtime/solverWorker` or
    `@corgiban/worker/runtime/benchmarkWorker`
- Worker runtimes call `preloadSolverKernels()` once per worker process.
  - preload deduplicates configured URLs
  - preload is best-effort
  - failed fetch/instantiate attempts do not fail solve or bench execution
- No protocol fields are added for kernel delivery in protocol v2.
- The TS kernel path remains the required fallback when no URLs are configured or preload fails.

## Consequences

**Positive:**

- Keeps worker/runtime packages independent from Remix/Vite asset-url mechanics.
- Avoids protocol churn for an optional optimization path.
- Preserves deterministic functional behavior because TS kernels remain authoritative fallback.

**Negative:**

- Introduces a documented global bootstrap shape (`__corgibanSolverKernelUrls`).
- Kernel delivery now depends on app-level environment wiring and asset hosting discipline.
- Preload success is intentionally not surfaced as a hard guarantee to callers.

## Alternatives considered

- Add kernel URLs to worker protocol messages.
- Hard-code asset URLs inside `packages/worker`.
- Require app adapters to preload kernels manually before every solve/bench run.

## Rollout plan (if applicable)

- Keep the env/global bootstrap contract limited to app-owned `*.client.ts` worker adapters.
- Keep worker preload best-effort until benchmark evidence justifies stronger lifecycle handling.
- Treat future protocol-driven or package-internal kernel delivery as a new ADR rather than
  silently changing this contract.

## Testing plan

- App bootstrap tests verify env validation, absolute normalization, and global config application.
- Worker runtime tests verify URL dedupe, one-time preload behavior, and failure fallback.
- Solve/bench runtime tests verify execution still succeeds when no kernel URLs are configured or
  kernel loading fails.

## Links

- `docs/Architecture.md` (sections 3.10, 4.2, and 11.3)
- `docs/project-plan.md` (Phase 6 Task 5)
- `apps/web/app/ports/configureSolverKernelUrls.client.ts`
- `packages/worker/src/runtime/kernelLoader.ts`
