# apps/web

Remix application containing the product UI, routes, and orchestration.

## Responsibilities

- Remix routes: `/play`, `/bench`, and `/dev/ui-kit` (`/lab` planned for a later phase)
- UI composition (React components) and Tailwind styling
- State orchestration (Redux Toolkit) and workflow/thunks
- Canvas host + animation playback scheduling (RAF time accumulator, shadow GameState outside Redux)
- Worker clients (via ports/adapters) for solver + benchmarks
- Persistence adapters (IndexedDB, File System Access export/import)

## Current status (Phase 4 benchmark + settings integration)

- Routes: `/play` (interactive), `/bench` (benchmark workflows), and `/dev/ui-kit` (design system); `/lab` is still planned.
- State: RTK store includes `game`, `solver`, `bench`, and `settings` slices.
- Play:
  - GameState is derived from move history using core helpers.
  - Solver panel runs/cancels solves, shows progress, and can apply/animate results.
  - Settings include default solver budgets (time/node), and `/play` solve orchestration uses those defaults with defensive fallback to solver constants.
  - Optional env toggle: `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1` enables light validation mode for high-frequency `SOLVE_PROGRESS` messages in the solver client; strict mode remains default.
- Bench:
  - `/bench` renders suite builder, run/cancel controls, diagnostics, persisted results, and import/export controls.
  - Bench workflow uses injected ports (`BenchmarkPort`, `PersistencePort`) via thunks; UI components do not call persistence adapters directly.
  - Worker-level benchmark progress streaming is spectator-only and adapter-gated; `/bench` keeps spectator stream disabled unless a per-run worker-progress consumer is explicitly attached.
  - Persistence initialization feature-detects `navigator.storage.persist()` and records diagnostics (`granted | denied | unsupported`), with console logging only in dev+debug mode.
  - Performance instrumentation (`performance.mark/measure`) is observed via `PerformanceObserver` and rendered in a debug perf panel.
  - File System Access API export/import is feature-detected with fallback to anchor download and file input.
- Replay: controller is wired to solver playback controls.
- Store lifecycle: route-scoped stores inject ports and dispose worker/persistence resources on unmount.
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
- Dynamic imports and `useEffect()` are **not** approved escape hatches for worker construction
- Never import worker runtime code from Remix loaders/actions

## Testing

- Component tests: React Testing Library
- Route behavior tests: keep deterministic, prefer unit-style tests
- Avoid snapshotting canvas pixels; test render plans where possible

## Key dependencies

- React + TypeScript
- TailwindCSS
- Redux Toolkit
- Worker client from `packages/worker`
