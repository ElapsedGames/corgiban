# Start here

This repository is the **planning + architecture baseline** for the Corgiban product:
- Sokoban-style gameplay in a modern React/TypeScript/Tailwind app
- Multiple solver algorithms running in Web Workers
- Benchmarking and analysis tools
- Optional extensions: Web Components embed, Level Lab/dev tooling, and performance kernels (WASM later)

## 1) What to read (in order)

1. `docs/Architecture.md` - architecture, boundaries, and system contracts
2. `docs/adr/README.md` - ADR process, status values, and naming
3. `docs/project-plan.md` - phased execution plan + acceptance criteria per phase
4. `docs/Engineering-Process-Playbook.md` - engineering process and quality gates
5. `docs/dev-tools-spec.md` - boundary tooling and repo automation
6. Package README(s) for the surface you are changing:
   - `packages/core/README.md`
   - `packages/solver/README.md`
   - `packages/worker/README.md`
   - `apps/web/README.md`
7. `CONTRIBUTING.md` - contributor workflow and expectations
8. `LLM_GUIDE.md` - canonical collaboration and repository rules (humans + agents)

## 2) Where the code will live

Top-level layout (target):

- `apps/web/` - Remix app (UI, routes, Tailwind, orchestration). README exists.
- `packages/core/` - pure game engine (no DOM, deterministic). README exists.
- `packages/solver/` - algorithms + heuristics (pure, deterministic). README exists.
- `packages/worker/` - worker runtime + protocol + client(s). README exists.
- `packages/benchmarks/` - benchmark models + runner (executed in workers). Planned. README added when scaffolded.
- `packages/embed/` - optional Web Component embed adapter. Planned. README added when scaffolded.
- `packages/solver-kernels/` - optional accelerated kernels (TS first, WASM later). Planned. README added when scaffolded.

## 3) How to execute the plan

The plan is intentionally phased to keep diffs reviewable and the repo consistently green.

- Implement **one phase per PR/prompt**.
- Each phase ends with passing checks before moving to the next phase.
- If you introduce a new subsystem or cross-cutting pattern, record the decision in an ADR.

See `docs/project-plan.md` for the canonical phase breakdown and acceptance criteria.

## 4) Architecture quick scan (10 bullets)

- Remix-first app shell (routes + error boundaries)
- Workers for solver and benchmarks; protocol is versioned and validated
- Domain packages are framework-agnostic (no React/DOM in core/solver)
- Push-based solver model (macro pushes expanded to move strings for playback)
- Benchmarks run in a worker pool and persist to IndexedDB with migrations
- Canvas rendering is testable: `buildRenderPlan()` (pure) + `draw()` (thin)
- Design system via Tailwind + tokens; `/dev/ui-kit` route validates primitives
- Strict input validation and size constraints for imported data
- Quality gates: strict TS, boundary enforcement, high unit coverage
- Optional extensions behind feature flags (embed, lab, WASM kernels, dev env)

## 5) Decision records (ADRs)

ADRs live in `docs/adr/`.

- Read `docs/adr/README.md` first for process and status expectations.
- Start new records from `docs/adr/0000-template.md`.
- Name files as `NNNN-kebab-case-title.md` (example: `0003-worker-protocol-v2.md`).

When you make a durable decision (protocol semantics, persistence schema, routing approach, solver model, etc.), add an ADR.

## 6) Community and security

- Read `CODE_OF_CONDUCT.md` for collaboration expectations.
- Use `SECURITY.md` to report vulnerabilities through a non-public path.
