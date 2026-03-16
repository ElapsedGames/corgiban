# Start here

This repository is a public Corgiban proof-of-concept reference with implementation,
architecture, and process docs kept in sync. It is not actively maintained; use these docs as a
continuation baseline for forks:

- Sokoban-style gameplay in a modern React/TypeScript/Tailwind app
- Multiple solver algorithms running in Web Workers
- Benchmarking and analysis tools
- Optional/advanced extensions: Web Components embed, `/lab` dev tooling, and performance kernels
  (TS-first, WASM optional)

## 1) What to read (in order)

1. `docs/Architecture.md` - architecture, boundaries, and system contracts
2. `docs/adr/README.md` - ADR process, status values, and naming
3. `docs/project-plan.md` - phased execution plan + acceptance criteria per phase
4. `docs/Engineering-Process-Playbook.md` - engineering process and quality gates
5. `docs/dev-tools-spec.md` - boundary tooling and repo automation
6. Package README(s) for the surface you are changing:
   - `packages/shared/README.md`
   - `packages/levels/README.md`
   - `packages/formats/README.md`
   - `packages/core/README.md`
   - `packages/solver/README.md`
   - `packages/solver-kernels/README.md`
   - `packages/worker/README.md`
   - `packages/benchmarks/README.md`
   - `packages/embed/README.md`
   - `apps/web/README.md`
7. `CONTRIBUTING.md` - contributor workflow and expectations
8. `docs/security-guidance.md` - current lint-enforced security rules and trust-boundary guidance
9. `LLM_GUIDE.md` - canonical collaboration and repository rules (humans + agents)

## 2) Where the code will live

Top-level layout (current):

- `apps/web/` - Remix app (UI, routes, Tailwind, orchestration, `/play`, `/bench`, `/lab`). README exists.
- `packages/shared/` - shared primitives and hard constraints. README exists.
- `packages/levels/` - built-in levels and schema helpers. README exists.
- `packages/formats/` - XSB/SOK/SLC import/export adapters. README exists.
- `packages/core/` - pure game engine (no DOM, deterministic). README exists.
- `packages/solver/` - algorithms + heuristics (pure, deterministic). README exists.
- `packages/solver-kernels/` - TS-first performance kernels with optional WASM loader hooks. README exists.
- `packages/worker/` - worker runtime + protocol + client(s). README exists.
- `packages/benchmarks/` - benchmark contracts + runner (executed in workers). README exists.
- `packages/embed/` - Web Component embed adapter. README exists.

## 3) How to use the plan

The plan is intentionally phased to keep diffs reviewable and quality gates explicit.

- Implement **one phase per PR/prompt**.
- Each phase ends with passing checks before moving to the next phase.
- If you introduce a new subsystem or cross-cutting pattern, record the decision in an ADR.

See `docs/project-plan.md` for the canonical phase breakdown and acceptance criteria.

## 4) Architecture quick scan (11 bullets)

- Remix-first app shell (routes + error boundaries)
- Workers for solver and benchmarks; protocol is versioned and validated
- Domain packages are framework-agnostic (no React/DOM in core/solver)
- Push-based solver model (macro pushes expanded to move strings for playback)
- Benchmarks run in a worker pool, persist to IndexedDB, and expose strict comparison metadata
- Canvas rendering is testable: `buildRenderPlan()` (pure) + `draw()` (thin), with sprite-atlas
  worker fallback behavior owned in `apps/web`
- Design system via Tailwind + tokens; `/dev/ui-kit` route validates primitives
- `/lab` provides format parsing, preview/play checks, and worker-backed solve/bench sanity runs
- Strict input validation and size constraints for imported data
- Quality gates: strict TS, boundary enforcement, high unit coverage
- Optional and late-phase extensions stay bounded and additive:
  `packages/embed`, WASM kernel promotion, and the Phase 10 `/lab` browser-dev workspace

## 5) Decision records (ADRs)

ADRs live in `docs/adr/`.

- Read `docs/adr/README.md` first for process and status expectations.
- Start new records from `docs/adr/0000-template.md`.
- Name files as `NNNN-kebab-case-title.md` (example: `0003-worker-protocol-v2.md`).

When you make a durable decision (protocol semantics, persistence schema, routing approach, solver model, etc.), add an ADR.

## 6) Community and security

- Read `CODE_OF_CONDUCT.md` for collaboration expectations.
- Use `SECURITY.md` to report vulnerabilities through a non-public path.
- Use `docs/security-guidance.md` for repo-level secure-source rules and trust-boundary guidance.
