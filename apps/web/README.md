# apps/web

Remix application containing the product UI, routes, and orchestration.

## Responsibilities

- Remix routes: `/play`, `/bench`, `/lab`, and `/dev/ui-kit`
- UI composition (React components) and Tailwind styling
- State orchestration (Redux Toolkit) and workflow/thunks
- Canvas host + animation playback scheduling (RAF time accumulator, shadow GameState outside Redux)
- Worker clients (via ports/adapters) for solver + benchmarks
- Persistence adapters (IndexedDB, File System Access export/import)

## Current status (Phase 6 adapters + tooling integration)

- Routes: `/play` (interactive), `/bench` (benchmark workflows), `/lab` (level editor and worker checks), and `/dev/ui-kit` (design system).
- State: RTK store includes `game`, `solver`, `bench`, and `settings` slices.
- `/play` and `/bench` use route-scoped RTK stores; `/lab` intentionally keeps authoring,
  preview, and one-click worker status local to `LabPage` and talks to worker ports directly.
- `/play` and `/bench` create those route-scoped stores with mutable no-op ports during render,
  then replace them with browser-backed worker/persistence ports after commit so SSR stays pure and
  each route keeps a stable store instance across hydration.
- `/play` and `/bench` sync `settings.theme` to the root `<html>` class after commit; the SSR app
  shell defaults to `light` so hydration matches the current settings default.
- Play:
  - GameState is derived from move history using core helpers.
  - Canvas rendering can use OffscreenCanvas sprite-atlas pre-rendering via a worker when
    supported, with main-thread draw fallback.
  - `GameCanvas` clamps its effective cell size to the available container width so small screens
    keep the board inside the route layout without distorting the render contract.
  - Solver panel runs/cancels solves, shows progress, and can apply/animate results.
  - Settings include default solver budgets (time/node), and `/play` solve orchestration uses those defaults with defensive fallback to solver constants.
  - Optional env toggle: `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1` enables light validation mode for high-frequency `SOLVE_PROGRESS` messages in the solver client; strict mode remains default.
  - Optional solver-kernel env wiring:
    `VITE_SOLVER_KERNEL_REACHABILITY_URL`, `VITE_SOLVER_KERNEL_HASHING_URL`, and
    `VITE_SOLVER_KERNEL_ASSIGNMENT_URL` seed worker bootstrap config for best-effort WASM preload.
    Values must be absolute URLs or app-root-relative paths; accepted values are normalized to
    absolute URLs before bootstrap. Failed loads fall back to TS kernels without blocking
    solve/bench flows.
- Bench:
  - `/bench` renders suite builder, run/cancel controls, diagnostics, persisted results, and import/export controls.
  - Warm-up repetitions are configurable; warm-up runs execute but are excluded from measured persisted result history.
  - Analytics/comparison panel provides success rate and p50/p95 elapsed-time summaries plus
    versioned comparison snapshot export; deltas are computed only when stored comparable metadata
    (solver options, environment, and warm-up settings) matches the selected baseline exactly.
    Export stays disabled only when the selected baseline lacks comparable metadata; non-comparable
    suites remain visible with explicit reasons and null deltas.
  - Bench workflow uses injected ports (`BenchmarkPort`, `PersistencePort`) via thunks; UI components do not call persistence adapters directly.
  - Route composition creates the browser-backed persistence adapter through `app/ports/persistencePort.client.ts`, keeping `app/infra/persistence` behind the port boundary.
  - Worker-level benchmark progress streaming is spectator-only and adapter-gated; `/bench` keeps spectator stream disabled unless a per-run worker-progress consumer is explicitly attached.
  - Persistence initialization feature-detects `navigator.storage.persist()` and records diagnostics (`granted | denied | unsupported`), with console logging only in dev+debug mode.
  - Diagnostics also surface repository durability health (`durable | memory-fallback | unavailable`) independently from `storage.persist()` outcomes; `memory-fallback` is sticky until storage reset/recreation.
  - Performance instrumentation (`performance.mark/measure`) is observed via `PerformanceObserver` and rendered in a debug perf panel.
  - File System Access API export/import is feature-detected with fallback to anchor download and file input.
  - Level-pack import requires a versioned contract (`type` + `version`) and recognized built-in
    level ids.
  - App-generated benchmark report exports include `exportedAtIso` convenience metadata; app-
    generated level-pack exports include both `levelIds` and `levels` plus `exportedAtIso`.
- Lab:
  - `/lab` provides format-aware single-level parsing (CORG/XSB/SOK/SLC), canvas preview, and
    one-click worker solve/bench checks. Multi-level XSB/SOK/SLC payloads are rejected with an
    explicit error so the editor always operates on one committed level at a time.
  - Lab import/export uses a strict versioned JSON payload contract (`corgiban-lab-level`,
    version `1`): required `type`, `version`, `format`, and `content`; optional
    `exportedAtIso`; unknown top-level fields are rejected on import.
  - Successful parse/import commits advance an authored-input revision so stale solve/bench
    callbacks are ignored after the active level changes.
  - Failed parses leave the committed level and authored revision untouched, so in-flight
    solve/bench work continues against the last successful parse.
- Offline/PWA:
  - Workbox-backed service worker registration is enabled in production builds.
  - Dev-only PWA worker registration can be enabled with `VITE_ENABLE_PWA_DEV=1` for local smoke validation.
- Replay: controller is wired to solver playback controls.
- Store lifecycle: route-scoped stores inject ports and dispose worker/persistence resources on
  unmount for `/play` and `/bench`; `/lab` applies the same dispose discipline with direct
  `SolverPort` / `BenchmarkPort` refs.
- Solver recommendation/availability contract: `chooseAlgorithm` only recommends implemented ids; when enabling new algorithms, keep solver `IMPLEMENTED_ALGORITHM_IDS` and `/play` option enablement in sync.

## Non-responsibilities

- Game rules and mutation logic (belongs in `packages/core`)
- Solver algorithms and heuristics (belongs in `packages/solver`)
- Heavy compute loops (belongs in workers via `packages/worker`)

## Client-only boundaries (Remix)

Worker creation and browser-only APIs must be used in client-only contexts:

- `*.client.ts` modules only - the ESLint `WORKER_CREATION_RULE` flags `new Worker()` everywhere else
- `/play` solver wiring uses a Vite worker-url adapter:
  `solverWorker.client.ts?worker&url` -> `new Worker(workerUrl, { type: "module" })`
  with runtime bootstrap from `@corgiban/worker/runtime/solverWorker`
- Worker bootstrap modules may import `configureSolverKernelUrls.client.ts` before worker runtime
  bootstrap so optional solver-kernel URLs are applied in one client-only place. That bootstrap
  accepts only absolute URLs or app-root-relative paths and normalizes accepted values before
  publishing `globalThis.__corgibanSolverKernelUrls`.
- Dynamic imports and `useEffect()` are **not** approved escape hatches for worker construction
- Never import worker runtime code from Remix loaders/actions

## Troubleshooting

- Vite dev must keep React runtime entrypoints deduped (`react`, `react-dom`,
  `react/jsx-runtime`, and `react/jsx-dev-runtime`) or hydration can fail with
  invalid-hook errors caused by split React dispatcher state.
- If dev shows hook errors such as `dispatcher is null`, `can't access property "useMemo", dispatcher is null`,
  or other hydration-only invalid-hook failures, fully restart the dev server.
- If the problem persists after restart, clear `apps/web/node_modules/.vite` and start `pnpm dev`
  again so Vite rebuilds its optimized dependency cache.

## Testing

- Component tests: React Testing Library
- Route behavior tests: keep deterministic, prefer unit-style tests
- Avoid snapshotting canvas pixels; test render plans where possible

## Key dependencies

- React + TypeScript
- TailwindCSS
- Redux Toolkit
- Worker client from `packages/worker`
