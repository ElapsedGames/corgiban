# Corgiban

Corgiban is a Sokoban-style puzzle game with a solver and benchmark focus. The project targets a clean TypeScript monorepo with a deterministic core engine, worker-based solvers, and strong test coverage.
Domain packages (`core`, `solver`, `worker`, `benchmarks`) are framework-agnostic and reusable outside the Remix app shell.

## Next milestone

- Governance baseline, ADRs, and package scaffolding are in place.
- Next: implement Phase 1 (levels + core engine) with high unit coverage.
- Follow-up phases will implement the play UI, worker protocol, solver algorithms, and benchmarks.

## Goals

- Deterministic, testable game engine
- Multiple solver algorithms (BFS, A*, IDA*)
- Web Worker execution with progress and cancellation
- Benchmark UI with local persistence
- High unit test coverage enforced in CI

## Current Status

- Governance docs, ADRs, and package scaffolding are in place.
- Architecture, planning, tooling, and process docs are in place.
- Core packages (`core`, `solver`, `worker`) and `apps/web` have README boundaries defined; implementation begins in Phase 1.
- The repository is public for visibility, but it is not accepting PRs yet and issues are disabled for now.

## Quickstart

Root commands (available once Phase 0 scaffold is fully wired):

```bash
pnpm i
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm build
```

## Technology Placements

- Web Workers: solver and benchmark execution (`packages/worker`).
- Web Components: `packages/embed` uses Shadow DOM, scoped stylesheet injection, and a self-contained React runtime, and it is optional for third-party embedding so `apps/web` does not depend on it or carry it on the core bundle path.
- WASM: `packages/solver-kernels` is TS-first, then Rust + `wasm-pack` kernels loaded lazily in workers after profiling.
- Advanced browser APIs: IndexedDB, File System Access API, `performance.mark/measure`, `PerformanceObserver`, `navigator.storage.persist()`, PWA/service worker, OffscreenCanvas.
- Remix: main app shell from the start in `apps/web` (Vite mode, React/TypeScript/Tailwind).

## Plan (Phased)

1. Tooling and boundaries
   - pnpm workspace config
   - root package.json
   - TypeScript project references per package
   - ESLint boundary rules
2. Core engine
   - movement rules, undo/redo, win detection
   - level parsing/encoding
   - high unit test coverage
3. React UI parity
   - layout, input, history, replay
   - canvas renderer
4. Worker protocol and baseline solver
   - versioned protocol
   - BFS solver
   - progress and cancellation
5. Solver expansion
   - A*, IDA*
   - heuristics and deadlocks
6. Benchmark page and persistence
   - suite runner
   - results storage and comparison
7. Optional browser dev environments
   - Sandpack/WebContainers in `/lab` via dynamic import + feature flag (default OFF)

## Repo Layout (Planned)

```
/apps
  /web (Remix app)
/packages
  /shared
  /levels
  /core
  /solver
  /worker
  /benchmarks
  /embed
  /solver-kernels
/tools
/docs
  Architecture.md
  project-plan.md
  dev-tools-spec.md
  Engineering-Process-Playbook.md
  /adr
```

## Documentation Map

- `LLM_GUIDE.md` (canonical collaboration and quality policy)
- `docs/Architecture.md` (system architecture, package boundaries, and core decisions)
- `docs/project-plan.md` (phases, acceptance criteria, and implementation order)
- `docs/dev-tools-spec.md` (boundary enforcement and tooling implementation details)
- `docs/Engineering-Process-Playbook.md` (execution process, governance, and conflict resolution)
- `AGENTS.md` and `CLAUDE.md` (thin wrappers pointing to `LLM_GUIDE.md`)

## Out of Scope (By Design)

- Multiplayer or co-op gameplay
- Monetization/payments
- Native mobile app targets
- Plugin marketplace/extensibility framework
