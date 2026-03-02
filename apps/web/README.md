# apps/web

Remix application containing the product UI, routes, and orchestration.

## Responsibilities

- Remix routes: `/play`, `/bench`, `/lab` (and `/dev/ui-kit`)
- UI composition (React components) and Tailwind styling
- State orchestration (Redux Toolkit) and workflow/thunks
- Canvas host + animation playback scheduling (RAF time accumulator, shadow GameState outside Redux)
- Worker clients (via ports/adapters) for solver + benchmarks
- Persistence adapters (IndexedDB, File System Access export/import)

## Current status (Phase 2 complete)

- Routes: `/play` (interactive), `/bench` (placeholder), and `/dev/ui-kit` (design system); `/lab` is still planned.
- State: RTK store includes `game`, `solver`, and `settings` slices; bench slice and solver wiring are pending.
- Play: GameState is derived from move history using core helpers; render plan split and keyboard/sequence input are wired.
- Replay: controller scaffolding exists; UI integration is pending.

## Non-responsibilities

- Game rules and mutation logic (belongs in `packages/core`)
- Solver algorithms and heuristics (belongs in `packages/solver`)
- Heavy compute loops (belongs in workers via `packages/worker`)

## Client-only boundaries (Remix)

Worker creation and browser-only APIs must be used in client-only contexts:

- `*.client.ts` modules only - the ESLint `WORKER_CREATION_RULE` flags `new Worker()` everywhere else
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
