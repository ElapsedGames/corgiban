# apps/web

Remix application containing the product UI, routes, and orchestration.

## Responsibilities

- Remix routes: `/play`, `/bench`, and `/dev/ui-kit` (`/lab` planned for a later phase)
- UI composition (React components) and Tailwind styling
- State orchestration (Redux Toolkit) and workflow/thunks
- Canvas host + animation playback scheduling (RAF time accumulator, shadow GameState outside Redux)
- Worker clients (via ports/adapters) for solver + benchmarks
- Persistence adapters (IndexedDB, File System Access export/import)

## Current status (Phase 3 solver integration)

- Routes: `/play` (interactive), `/bench` (placeholder), and `/dev/ui-kit` (design system); `/lab` is still planned.
- State: RTK store includes `game`, `solver`, and `settings` slices; bench slice is pending.
- Play: GameState is derived from move history using core helpers; render plan split and keyboard/sequence input are wired. Solver panel runs/cancels solves, shows progress, and can apply/animate results.
- Level-change workflow: `handleLevelChange` thunk cancels any active solve before resetting solver run state and recomputing recommendation.
- Replay: controller is wired to solver playback controls.
- Store lifecycle: `/play` creates a route-scoped store with injected `SolverPort` and disposes it on route unmount.
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
