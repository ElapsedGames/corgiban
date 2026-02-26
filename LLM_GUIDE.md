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
   - `packages/core/README.md`
   - `packages/solver/README.md`
   - `packages/worker/README.md`
   - `apps/web/README.md`

If documentation is missing, create the smallest doc needed (see Documentation routing).

---

## 2. Golden rules

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
- If wall-clock time is needed, source it through `packages/shared/src/time.ts` and pass values via explicit parameters at boundaries.

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

Rule: Adapters must not import storage/persistence directly. Adapters call workflows; workflows call ports; ports use adapters.

### 4.2 Package boundary rules (hard)
- `packages/core` imports only `packages/shared` and `packages/levels`.
- `packages/solver` imports only `core` and `shared`.
- `packages/worker` imports only `solver`, `core`, `shared`, and `benchmarks`.
- `packages/benchmarks` imports only `solver`, `core`, and `shared`.
- `apps/web` imports packages through their public entrypoints only.
- Extend this boundary list explicitly when optional packages such as `embed` and `solver-kernels` are introduced.

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
- Level encoding/decoding lives in one place (`core/encoding` + `levels` schema).
- Worker messages are shaped and validated centrally (`packages/worker/protocol`).

Rule: No ad-hoc JSON shape copies across features.

### 7.2 Version and validate worker protocol
All worker messages must include:
- `protocolVersion`
- `runId`

Validate both directions:
- main thread validates worker responses
- worker validates main thread requests

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
- Module worker construction pattern:
  `new Worker(new URL("./solverWorker.ts", import.meta.url), { type: "module" })`.
- `packages/embed` (when introduced) defaults to Shadow DOM with scoped stylesheet injection and
  bundles React as a dependency (not a peer dependency).
- `packages/solver-kernels` (when introduced) stays TS-first; WASM promotion uses Rust +
  `wasm-pack`, lazy-loaded in workers via `fetch` + `WebAssembly.instantiateStreaming` with
  fallback to `WebAssembly.instantiate`.
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

Prefer PRs that:
- touch a small number of packages
- keep refactors separate from behavior changes
- add tests in the same PR as the behavior change

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
- Default to ASCII characters only.
- No smart punctuation (curly double quotes, curly single quotes, em dash, en dash, ellipsis, right arrow, less-than-or-equal symbol) unless explicitly justified in the PR description or ADR.

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
- regression tests added for any pruning/deadlock change
- no DOM/Web APIs used

### 13.3 If you touch `packages/worker` protocol
- schemas updated on both sides
- protocol versioning respected
- client and worker tests added or updated

### 13.4 If you touch benchmarks
- persistence schema migration considered (IndexedDB)
- results remain comparable across runs (metadata captured)
- time/node budgets enforced

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
