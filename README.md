# Corgiban

Corgiban is a Sokoban-style puzzle game workspace focused on deterministic gameplay, worker-based
solver execution, and benchmark-driven iteration.

Domain packages stay framework-agnostic (`core`, `solver`, `benchmarks`). The Remix app in
`apps/web` orchestrates UI state and adapters, while `packages/worker` keeps heavy compute off the
main thread with versioned, runtime-validated protocol messages. The current deployment target is
Cloudflare Pages via a thin adapter layer inside `apps/web`, while shared Remix document rendering
stays host-neutral.

## Project State

- Phase 0 complete: monorepo/tooling scaffold, strict boundaries, and governance docs.
- Phase 1 complete: levels + deterministic core engine.
- Phase 2 complete: `/play` UI parity and canvas renderer split (`buildRenderPlan` + `draw`).
- Phase 3 complete: versioned worker protocol, baseline push-based BFS solver, solver client/runtime, and `/play` solver controls + replay integration.
- Phase 4 complete: benchmark domain package, benchmark worker/runtime/client flows, worker pool orchestration, `/bench` UI, and IndexedDB-backed persistence with import/export and diagnostics.
- Phase 5 complete: coverage/boundary quality gates verified, solver ping timeout hardening, Playwright smoke coverage, and Workbox-based offline shell support.
- Phase 6 complete: `/lab` route is live, `packages/formats` / `packages/embed` / `packages/solver-kernels` are active, OffscreenCanvas sprite-atlas pre-rendering is integrated with fallback, benchmark analytics/comparison flows are live, and level-pack/persistence contracts are hardened.
- Next Step: Phase 7 focuses on the UX and route-responsibility pass across `/play`, `/lab`, and `/bench`. Deferred cleanup and tooling debt stays tracked in `.tracker/issues/*.md` and `KNOWN_ISSUES.md` instead of blocking phase closeout.

Current routes:

- `/`: redirects to `/play`, keeping gameplay as the primary product entry.
- `/play`: playable level flow with keyboard plus tap/click/swipe board input, history, undo/restart, solver run/cancel, progress, apply/animate solution, and worker retry flow.
- `/bench`: benchmark suite builder (including warm-up reps), run/cancel controls, progress + diagnostics, persisted results table, analytics/comparison panel, and benchmark import/export flows.
- `/lab`: Level Lab route for authoring and converting CORG/XSB/SOK/SLC input, previewing levels, and running one-click worker solve/bench checks.
- `/dev/ui-kit`: UI primitive validation route (direct access, not primary nav).

## Goals

- Deterministic, testable game engine
- Multiple solver algorithms (BFS baseline, A* and IDA* planned)
- Worker execution with progress and cancellation
- Benchmark UI with local persistence and reproducible run metadata
- High unit coverage with strict CI gates

## Quickstart

```bash
pnpm i
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm test:smoke
```

Playwright setup (once per machine):

```bash
pnpm exec playwright install chromium
```

Production-style preview uses the Cloudflare Pages adapter path:

```bash
pnpm -C apps/web preview
```

## Validation Commands

```bash
pnpm format:check
pnpm style:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:coverage
pnpm test:smoke
pnpm levels:rank
pnpm exec depcruise --config dependency-cruiser.config.mjs packages/ apps/
node tools/scripts/encoding-check.mjs
```

## Local issue tracker

GitHub issues are disabled for this repo. Track non-trivial bugs, review findings, regressions,
and deferred cleanup in `.tracker/issues/*.md`, regenerate `KNOWN_ISSUES.md` with
`pnpm issue:generate`, and use `pnpm issue:check` to verify the dashboard is in sync.

## Repo Layout

Current:

```
/apps
  /web
/packages
  /shared
  /levels
  /formats
  /core
  /solver
  /solver-kernels
  /worker
  /benchmarks
  /embed
/tools
/docs
```

Planned next-phase extensions:

- Phase 7: UX and route-responsibility pass across `/play`, `/lab`, and `/bench`
- Phase 8: solver optimization and advanced search
- Phase 9: UI/visual polish and sprite/art pass
- Phase 10: `/lab` browser-dev workspace (Sandpack/WebContainers, feature-gated)
- Phase 11: Race Mode and multi-runner `/play` workflows
- benchmark/report evolution beyond current versioned contracts

## Documentation Map

- `LLM_GUIDE.md` (canonical collaboration and quality policy)
- `docs/Architecture.md` (system architecture, boundaries, protocols)
- `docs/project-plan.md` (phases, tasks, integration proofs)
- `docs/dev-tools-spec.md` (boundary and tooling implementation details)
- `docs/Engineering-Process-Playbook.md` (execution/governance process)
- `docs/cloudflare-pages-deployment.md` (first-time Cloudflare Pages setup and deploy flow)
- `docs/review-notes.md` (review-sensitive existing contracts that are intentional, not defects)
- `docs/adr/*` (architecture decision records)
- `AGENTS.md` and `CLAUDE.md` (thin wrappers pointing to `LLM_GUIDE.md`)

## Out of Scope (By Design)

- Multiplayer or co-op gameplay
- Monetization/payments
- Native mobile app targets
- Plugin marketplace/extensibility framework
