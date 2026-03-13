# LLM_GUIDE.md -- Engineering and AI Collaboration Rules (Corgiban)

This guide defines how humans and AI agents should work in this repository so changes stay:

- Readable
- Deterministic
- Testable
- Well-scoped
- Architecturally consistent

If a rule must be broken, document it briefly in the PR description and/or an ADR.

---

## 0. Source of truth and precedence

- `LLM_GUIDE.md` is the canonical engineering and collaboration authority for this repo.
- Supporting docs must align with this file:
  - `docs/Architecture.md`
  - `docs/project-plan.md`
  - `docs/dev-tools-spec.md`
  - `docs/Engineering-Process-Playbook.md`
- `AGENTS.md` and `CLAUDE.md` are wrappers only and must not override this file.

If guidance conflicts, resolve in this order:

1. `LLM_GUIDE.md`
2. `docs/Architecture.md`
3. `docs/project-plan.md`
4. `docs/dev-tools-spec.md`
5. `docs/Engineering-Process-Playbook.md`
6. wrappers (`AGENTS.md`, `CLAUDE.md`)

---

## 1. Read-first routing (before writing code)

When starting any task, read these in order:

1. `docs/Architecture.md` -- system boundaries, packages, protocols
2. `docs/adr/*` -- decisions and constraints (if present)
3. Package-level README(s):
   - `packages/shared/README.md`
   - `packages/core/README.md`
   - `packages/levels/README.md`
   - `packages/formats/README.md`
   - `packages/solver/README.md`
   - `packages/solver-kernels/README.md`
   - `packages/worker/README.md`
   - `packages/benchmarks/README.md`
   - `packages/embed/README.md`
   - `apps/web/README.md`

If documentation is missing, create the smallest doc needed (see Documentation routing).

---

## 2. Golden rules

### 2.0 Fight entropy. Leave the codebase better than you found it.

- This codebase will outlive you. Every shortcut you take becomes someone else's burden. Every hack compounds into technical debt that slows the whole team down.

- You are not just writing code. You are shaping the future of this project. The patterns you establish will be copied. The corners you cut will be cut again.

- Fight entropy. Leave the codebase better than you found it.

### 2.1 Keep code human-readable

- Optimize for clarity over cleverness.
- Prefer small modules over mega-files.
- Prefer explicit names and types over inference when it improves readability.

### 2.2 Keep changes scoped

- A single change should be explainable in isolation.
- Avoid drive-by refactors that mix formatting, logic, and architecture changes.

### 2.3 Keep the main thread responsive

- Anything that can expand combinatorially (solvers, benchmarks, heavy heuristics) belongs in workers.
- Main thread handles input, rendering, and orchestration only.

### 2.4 Determinism and banned APIs

- `SharedArrayBuffer` and `Atomics` are banned in all authored repo code (production, tests, and `tools/`).
- `packages/core` and `packages/solver` must not use `Date`/`Date.now` directly.
- Solver timing should prefer an explicit clock source at boundaries (for example a `nowMs`
  callback in solver context). `solve(...)` may fall back to `globalThis.performance.now()` when
  callers omit `nowMs`, but must return an explicit error when no monotonic clock is available.
- Typed arrays returned by `packages/core` and `packages/solver` are treated as immutable snapshots. Consumers must not mutate them.

---

## 3. File size and responsibility limits

- Keep files under 300-500 lines when feasible.
- At >550 lines, do a split review (decide whether to extract responsibilities).
- At >800 lines, split is required unless an exception is documented.

### 3.1 Naming conventions for split modules

- Use `lowerCamel.ts` for domain modules (example: `applyMove.ts`).
- Use `PascalCase.tsx` for React components.
- Prefer responsibility-specific names over generic files:
  - `*.types.ts`, `*.schema.ts`, `*.constants.ts`
  - `*.selectors.ts`, `*.thunks.ts`, `*.slice.ts`
  - avoid catch-all `utils.ts` when a domain name is clearer.

### 3.2 Split strategy when files grow

- Split by responsibility, not by arbitrary line count.
- Split in this order:
  - types/constants/schemas first
  - pure helpers next
  - orchestration and side-effect adapters last
- If a file is large due to type-only content, split into:
  - `types.ts`
  - `schema.ts`
  - `helpers.ts`
  - `index.ts` (public exports)

### 3.3 Allowed exceptions

- Generated files.
- Large static data/fixtures/level packs.
- Protocol/schema registries or lookup tables where splitting harms correctness/readability.
- Rare algorithm files where locality is safer than fragmentation.
- Exception files should still target <800 lines when possible and include a short `FILE_SIZE_EXCEPTION: <reason>` note near the top.

---

## 4. Boundary enforcement (dependency direction)

### 4.1 Layer direction (conceptual)

Adapters -> Workflows/Services -> Domain -> Infrastructure

Map the layers like this:

- Adapters
  - React components, UI event handlers, routes/pages
- Workflows
  - Redux thunks, orchestrators, playback scheduling, benchmark scheduling
- Domain
  - `packages/core` (engine)
  - `packages/solver` (algorithms)
- Infrastructure
  - `packages/worker` runtime + clients
  - persistence repositories (IndexedDB/localStorage adapters)
  - logging/telemetry adapters

Rule: Adapters must not import storage/persistence directly. Adapters call workflows; workflows call ports; ports use adapters. Narrow exception: the root app-shell theme bootstrap may read browser storage directly so the `<html>` theme class is resolved before paint. Keep that logic isolated to `apps/web/app/theme/*`; do not generalize it to feature-level state or adapters.

### 4.2 Package boundary rules (hard)

- `packages/core` imports only `packages/shared` and `packages/levels`.
- `packages/formats` imports only `packages/shared` and `packages/levels`.
- `packages/solver` imports only `core` and `shared`.
- `packages/solver-kernels` imports only `solver`, `core`, and `shared`.
- `packages/worker` imports only `solver`, `solver-kernels`, `core`, `shared`, and `benchmarks`.
- `packages/benchmarks` imports only `solver`, `core`, and `shared`.
- `packages/embed` is an adapter package and imports workspace packages via public entrypoints.
- `apps/web` imports packages through their public entrypoints only.

Enforce using:

- TypeScript project references
- ESLint `no-restricted-imports` / boundary rules

---

## 5. Change strategy (AI-friendly and review-friendly)

### 5.1 Prefer additive change + migration over in-place rewrites

When improving a subsystem:

- Add a small helper or module
- Migrate call sites incrementally
- Remove the legacy path only when:
  - tests cover both old and new behavior
  - all call sites are migrated
  - no public API break is introduced accidentally

### 5.2 Avoid sweeping rewrites

Avoid:

- renaming many files at once
- rewriting unrelated code for style
- converting patterns repo-wide in a single PR

### 5.3 Make state transitions and invariants explicit

- Keep engine and solver deterministic.
- Use named functions for steps that mutate state (even in reducers/thunks).
- Assert invariants in tests; optionally assert in dev builds.

### 5.4 Execution rule (phase discipline)

- Implement one phase per prompt/PR.
- Do not start later phases until the current phase acceptance criteria pass.

---

## 6. Transaction and atomicity rules (workflows)

Even though this is a frontend app, multi-step operations still need transaction discipline.

### 6.1 Make transaction boundaries explicit at the workflow layer

Examples:

- applying a solver solution to the current game state
- starting a benchmark suite run and persisting incremental results
- replay/animation operations that can be paused/cancelled

### 6.2 Multi-step operations must be atomic or compensating

If an operation can fail mid-way:

- either make it atomic (single state update), or
- define compensating behavior (rollback, cancellation, cleanup)

### 6.3 Background jobs must be:

- idempotent
- retry-safe
- restart-safe

Workers and benchmark runners should tolerate restarts and cancellations without corrupting persisted results.

---

## 7. Serialization and protocol discipline

### 7.1 Centralize serialization

- CORG encoding/decoding lives in one place (`core/encoding` + `levels` schema).
- External format adapters (XSB/SOK/SLC) live in `packages/formats`, not in `core/encoding`.
- Worker messages are shaped and validated centrally (`packages/worker/protocol`).

Rule: No ad-hoc JSON shape copies across features.

### 7.2 Version and validate worker protocol

All run-scoped worker messages must include:

- `protocolVersion`
- `runId`

Worker lifecycle messages (`PING`/`PONG`) include `protocolVersion` only.

- Do not introduce ad-hoc cancel message shapes. If the active protocol version does not define
  a run-cancel message, use the documented cancellation path for that version and record changes
  in an ADR.

Validate both directions:

- main thread validates worker responses
- worker validates main thread requests
- high-frequency progress validation may use a documented light mode, but structural
  messages (`SOLVE_START`, `BENCH_START`, `SOLVE_RESULT`, `BENCH_RESULT`, `SOLVE_ERROR`,
  `PING`, `PONG`) remain strict-schema validated
- progress throttling is solver-owned; worker runtimes request cadence through solver context and
  must not layer a second runtime throttle
- `BENCH_PROGRESS` streaming is opt-in (`enableSpectatorStream`); do not emit high-frequency
  benchmark progress when no consumer is attached

### 7.3 Never silently ignore configuration fields

- Validate inputs before persistence or execution.
- If an option is not supported, reject it and surface a readable error.

---

## 8. Configuration and global state

- Centralize config and constants (prefer `packages/shared`).
- Avoid hidden global singletons.
- `apps/web` runs Remix in Vite mode.
- Worker creation is done only in client-only `*.client.ts` modules;
  never from Remix loaders/actions/server entrypoints.
- Supported module worker construction patterns:
  - package-internal default:
    `new Worker(new URL("../runtime/solverWorker.ts", import.meta.url), { type: "module" })`
  - Remix/Vite app adapter (asset-url worker module):
    `import solverWorkerUrl from "./solverWorker.client.ts?worker&url";`
    `new Worker(solverWorkerUrl, { type: "module", name: "corgiban-solver" })`
- `packages/embed` defaults to Shadow DOM with scoped stylesheet injection and
  bundles React as a dependency (not a peer dependency).
- `packages/solver-kernels` stays TS-first; WASM promotion uses Rust +
  `wasm-pack`, lazy-loaded in workers via `fetch` + `WebAssembly.instantiateStreaming` with
  fallback to `WebAssembly.instantiate`.
- `apps/web` owns optional solver-kernel URL wiring for worker bootstraps.
  `configureSolverKernelUrls.client.ts` may seed `globalThis.__corgibanSolverKernelUrls` from
  `VITE_SOLVER_KERNEL_REACHABILITY_URL`, `VITE_SOLVER_KERNEL_HASHING_URL`, and
  `VITE_SOLVER_KERNEL_ASSIGNMENT_URL`; accepted values are absolute URLs or app-root-relative
  paths only, are normalized to absolute URLs before bootstrap, worker-side kernel preload remains
  best-effort, and the TS kernel path stays the required fallback.
- Optional `/play` validation-path toggle:
  `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1` enables solver-client outbound
  `light-progress` validation for `SOLVE_PROGRESS`; default remains strict validation.
- Optional PWA dev toggle:
  `VITE_ENABLE_PWA_DEV=1` enables service worker registration in dev builds for offline smoke
  validation; production builds register by default.
- `/play` and `/bench` use route-scoped Redux stores with injected ports.
- Route-scoped stores that depend on browser resources should be created with mutable no-op ports
  during render/SSR and replace those ports with browser-backed implementations after commit;
  preserve one stable route-store instance across hydration and do not create workers or
  persistence adapters during route render.
- Browser-session external stores consumed during route render (for example temporary level
  catalogs backed by `sessionStorage`) must provide a deterministic server snapshot and subscribe
  after hydration. Do not read `sessionStorage`/`localStorage` directly during SSR render for
  feature-level state.
- Hosting/runtime adapters stay isolated to the web app deployment layer.
  Host-specific files live under `apps/web/functions/*`, `apps/web/wrangler.jsonc`, and
  `preview:<host>` / `deploy:<host>` scripts. Keep `apps/web/app/server/*` and
  `apps/web/app/entry.server.tsx` host-neutral so they can be reused by multiple Remix hosts.
- Route modules and the root document should use `@remix-run/server-runtime` /
  `@remix-run/react` imports, not host packages such as `@remix-run/cloudflare`. If runtime-
  specific values are needed, pass them through explicit Remix load context.
- The root app shell owns the light/dark `<html>` theme class. Resolve the initial theme before
  paint from persisted browser preference with `prefers-color-scheme` fallback, and do not
  duplicate theme ownership in route-scoped Redux stores.
- Canvas board skins/themes live in app-local TS data under `apps/web/app/canvas/boardSkin.ts`.
  Keep main-thread draw fallback and worker-rendered atlas inputs on the same explicit
  `skinId`/`mode` contract; do not treat CSS custom properties as the source of truth for
  worker-consumed board visuals.
- `/lab` keeps authored text, preview state, and one-click solve/bench status in route-local
  React state + direct port refs; do not promote that tool-state into Redux until a concrete
  cross-route workflow requires it and an ADR documents the change.
- Keep Redux state/actions JSON-serializable; keep typed-array runtime caches outside Redux.

---

## 9. Testing and coverage policy (strict)

### 9.1 Coverage targets

- Repo-wide minimum: 95%+ lines/branches/functions/statements
- Domain packages (`core`, `solver`): aim for 98-100%

### 9.2 Tests required for:

- all non-trivial logic
- any data mutation
- any scheduling/playback logic
- solver behavior changes (including pruning/deadlock logic)
- protocol changes

### 9.3 Regression tests for bug fixes

Most bug fixes must include:

- a failing test reproducing the bug
- the fix
- the test passing

### 9.4 Prefer deterministic tests

- Avoid sleep-based timing tests.
- Use fake timers for playback logic.
- For worker protocol tests, prefer deterministic message simulations.

### 9.5 Run tests locally before commit

- Run full unit suite (not a partial subset)
- Run typecheck and lint
- Run `pnpm style:check` when touching `apps/web/app/styles/*`, `apps/web/tailwind.config.ts`,
  shared `apps/web/app/ui/*` primitives, or Tailwind-class-heavy app surfaces.
- Run `pnpm test:smoke` when touching route shell, PWA/offline behavior, or `/bench` persistence
  workflows.
- When offline smoke behavior or top-level reload proof changes, update
  `docs/verification/offline-top-level-proof.md` alongside the tests/docs.
- Pre-commit hooks (simple-git-hooks) run
  `pnpm exec tsx tools/scripts/normalize-ascii.ts --staged`, `pnpm format:check`,
  `pnpm exec tsx tools/scripts/style-policy-check.ts`, `node tools/scripts/run-affected-tests.mjs`,
  and `pnpm encoding:check:staged` on staged files. Local verification should run
  `pnpm encoding:check` for the current worktree, and CI runs `pnpm encoding:check:tracked`
  for tracked files (lint/typecheck remain required via local verification + CI).

---

## 10. Documentation routing (keep docs short and near code)

### 10.1 When to write architecture documentation

Write or update `docs/Architecture.md` when introducing:

- a new package or subsystem
- a new cross-cutting pattern (protocol, persistence, worker pooling)
- a new boundary rule

### 10.2 When to write feature documentation

Write a short feature doc when logic is:

- non-obvious
- stateful
- spans multiple layers (UI -> workflow -> domain -> worker)

Place it with the code:

- `packages/<pkg>/docs/<feature>.md`, or
- `apps/web/app/routes/<feature>/README.md`

### 10.3 ADRs for irreversible or costly decisions

Add an ADR under `docs/adr/` when:

- changing solver action model or state representation
- changing worker protocol semantics/versioning
- changing persistence model (benchmark DB schema)
- changing versioned benchmark/export artifact contracts (reports, comparison snapshots)
- changing state management approach

Keep ADRs small:

- context
- decision
- consequences
- alternatives considered (brief)

---

## 11. PR / change packaging conventions (for humans and AI)

Each PR should include:

- What changed (short)
- Why (1-3 bullets)
- How to test (commands)
- Files touched (if non-obvious)
- Follow-ups (optional)

When deferring a non-trivial bug, review finding, or cleanup:

- track it in `.tracker/issues/*.md`
- regenerate `KNOWN_ISSUES.md` with `pnpm issue:generate`
- do not leave it only as an untracked TODO/comment or in PR prose

Prefer PRs that:

- touch a small number of packages
- keep refactors separate from behavior changes
- add tests in the same PR as the behavior change

### 11.1 Source zip command

Use `pnpm zip:source` (runs `tools/scripts/make-source-zip.mjs`) to create a source archive.
Output goes to `artifacts/corgiban-workspace-source-<git>.zip`. If the working tree is dirty,
the archive includes the current worktree.

---

## 12. Style and readability conventions (project-specific)

### 12.1 TypeScript conventions

- Prefer strict typing; avoid `any`.
- Keep functions pure in `core` and `solver`.
- Avoid implicit side effects; thread them via explicit parameters.
- Prefer small, named helper functions over deeply nested logic.

### 12.2 Iteration conventions

- Prefer array/object iteration helpers over manual loops for readability.
- Avoid complex nested loops; extract helpers with clear names.

### 12.3 Comments

- Comment why (constraints, invariants, complexity), not what.
- For solver code, document:
  - pruning rules
  - heuristic assumptions
  - correctness constraints (admissibility, monotonicity if applicable)

### 12.4 Encoding and character set

- Text files must be UTF-8 without BOM.
- ASCII-only by default; any non-ASCII requires an explicit allow list entry and ADR/PR justification.
- No smart punctuation (curly double quotes, curly single quotes, em dash, en dash, ellipsis, right arrow, less-than-or-equal symbol) unless allowlisted with justification.

### 12.5 Web styling contract

- `apps/web/app/styles/tokens.css` is the source of truth for app-owned colors, radii, shadows,
  and theme tokens; mirror them in `apps/web/tailwind.config.ts`.
- In app components, use semantic Tailwind utilities (`bg-panel`, `text-muted`,
  `text-error-text`, `rounded-app-md`) instead of arbitrary `var(--color-*)` /
  `var(--radius-*)` escape hatches.
- Keep Tailwind core radius keys (`rounded-sm`, `rounded-md`, `rounded-lg`) on their framework
  defaults; app-token radii use `rounded-app-*`.
- Outside `tokens.css`, avoid raw hex / rgb / rgba color literals. Narrow exception:
  `apps/web/app/canvas/boardSkin.ts` may keep worker-consumed board palettes in app-local TS data
  because sprite-atlas workers cannot read the DOM token layer directly. `app.css` is for
  shell/layout behavior, not token duplication.
- When touching the web styling contract or shared UI primitives, review
  `apps/web/app/styles/README.md` and keep `pnpm style:check` passing.

---

## 13. Practical checklists

### 13.1 If you touch `packages/core`

- engine remains deterministic
- invariants validated in tests
- encoding/decoding stays compatible
- unit tests updated or added

### 13.2 If you touch `packages/solver`

- cancellation checks remain frequent enough
- progress reporting remains throttled and stable
- progress cadence stays single-sourced in solver helpers/context, not duplicated in worker runtime
- regression tests added for any pruning/deadlock change
- keep `IMPLEMENTED_ALGORITHM_IDS`, `chooseAlgorithm`, and UI availability in sync
- no DOM/Web APIs used
- if recommendation or `compileLevel(...)` cost changes, run
  `pnpm profile:analyze-level:browser` against preview and keep
  `docs/verification/analyze-level-main-thread-profile.md` current

### 13.3 If you touch `packages/worker` protocol

- schemas updated on both sides
- protocol versioning respected
- client and worker tests added or updated
- progress cadence remains solver-owned; runtime changes request cadence through solver context
- solver-client liveness remains deterministic (`ping(timeoutMs?)` idle-only, bounded timeout,
  explicit `crashed` transition on timeout/error)
- for validation-path changes, run `node tools/scripts/profile-worker-validation.mjs` and
  refresh `docs/_generated/analysis/phase-04-protocol-validation-profile.md`

### 13.4 If you touch benchmarks

- persistence schema migration considered (IndexedDB)
- results remain comparable across runs (metadata captured)
- benchmark report payloads are typed/versioned with explicit `exportModel`; current baseline model is `multi-suite-history`
- benchmark report imports reject unsupported versions/models and invalid records with explicit errors
- benchmark comparison exports rely on explicit comparable metadata (solver options, environment,
  warm-up settings) and compute deltas only when suite fingerprints match exactly
- level-pack imports require explicit `type`/`version` and validate accepted level-reference shapes
  (`levelIds` / `levels[].id`) with explicit errors for unsupported contracts
- time/node budgets enforced
- warm-up repetitions are explicitly modeled and excluded from measured benchmark result storage
- browser capability checks are explicit (`navigator.storage.persist`, File System Access APIs)
- unsupported browser APIs use documented fallback paths, not hard errors
- diagnostics capture storage persistence outcome, repository durability health
  (`durable | memory-fallback | unavailable`), and surfaced persistence errors/notices
- if persistence enters `memory-fallback`, degraded mode remains sticky for the active storage
  instance until reset/recreation
- perf instrumentation uses `performance.mark/measure` with observer-driven diagnostics in debug flows

---

## 14. One-liners for AI tasking

When delegating to AI or Codex, include:

- the exact package(s) involved
- the boundary constraints (what it must not import)
- the expected tests to add/modify
- expected inputs/outputs for the change (types, message shapes, etc.)

Example task prompt:
"Add corner-deadlock pruning in `packages/solver/deadlocks/` with unit tests. Do not change worker protocol. Keep changes additive."

---

## 15. Summary

This repo is designed for long-term solver iteration and benchmarking.
The rules above keep changes:

- architecturally consistent
- reviewable
- testable
- friendly to both humans and AI

If a rule becomes painful, propose an ADR to adjust it rather than silently drifting.
