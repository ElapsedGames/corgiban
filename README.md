# Corgiban

Corgiban is a Sokoban-style puzzle game workspace focused on deterministic gameplay, worker-based
solver execution, and benchmark-driven iteration.

Domain packages stay framework-agnostic (`core`, `solver`, `benchmarks`). The Remix app in
`apps/web` orchestrates UI state and adapters, while `packages/worker` keeps heavy compute off the
main thread.

## Project State

- Phase 0 complete: monorepo/tooling scaffold, strict boundaries, and governance docs.
- Phase 1 complete: levels + deterministic core engine.
- Phase 2 complete: `/play` UI parity and canvas renderer split (`buildRenderPlan` + `draw`).
- Phase 3 complete: versioned worker protocol, baseline push-based BFS solver, solver client/runtime, and `/play` solver controls + replay integration.
- Next milestone: Phase 4 benchmark page and persistence.

Current routes:

- `/play`: playable level flow with keyboard controls, history, undo/restart, solver run/cancel, progress, apply/animate solution, and worker retry flow.
- `/bench`: placeholder route for benchmark workflow in Phase 4.
- `/dev/ui-kit`: UI primitive validation route.

## Goals

- Deterministic, testable game engine
- Multiple solver algorithms (BFS baseline, A* and IDA* planned)
- Worker execution with progress and cancellation
- Benchmark UI with local persistence
- High unit coverage with strict CI gates

## Quickstart

```bash
pnpm i
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

## Validation Commands

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm exec depcruise --config dependency-cruiser.config.mjs packages/ apps/
node tools/scripts/encoding-check.mjs
```

## Repo Layout

Current:

```
/apps
  /web
/packages
  /shared
  /levels
  /core
  /solver
  /worker
  /benchmarks
/tools
/docs
```

Planned/optional later phases:

- `packages/formats` for external level format interop
- `packages/embed` for Web Component embedding
- `packages/solver-kernels` for optional accelerated kernels
- `/lab` route for level tooling and optional browser dev adapters

## Documentation Map

- `LLM_GUIDE.md` (canonical collaboration and quality policy)
- `docs/Architecture.md` (system architecture, boundaries, protocols)
- `docs/project-plan.md` (phases, tasks, integration proofs)
- `docs/dev-tools-spec.md` (boundary and tooling implementation details)
- `docs/Engineering-Process-Playbook.md` (execution/governance process)
- `docs/adr/*` (architecture decision records)
- `AGENTS.md` and `CLAUDE.md` (thin wrappers pointing to `LLM_GUIDE.md`)

## Out of Scope (By Design)

- Multiplayer or co-op gameplay
- Monetization/payments
- Native mobile app targets
- Plugin marketplace/extensibility framework
