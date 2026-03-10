# Corgiban Engineering Process Playbook

This document defines implementation and maintenance processes for Corgiban.
It is project-specific and aligns with `docs/Architecture.md`, `docs/project-plan.md`, and
`docs/dev-tools-spec.md`.

## 1. Source Of Truth And Conflict Resolution

1. `LLM_GUIDE.md` is the canonical collaboration and quality policy.
2. `docs/Architecture.md` defines architectural intent and subsystem boundaries.
3. `docs/project-plan.md` defines implementation phases, acceptance criteria, and execution standards.
4. `docs/dev-tools-spec.md` defines concrete boundary/tooling implementation details.
5. `AGENTS.md` and `CLAUDE.md` are wrappers and must not diverge from `LLM_GUIDE.md`.
6. If guidance conflicts, resolve in this order:
   - `LLM_GUIDE.md`
   - `docs/Architecture.md`
   - `docs/project-plan.md`
   - `docs/dev-tools-spec.md`
   - wrapper files

## 2. Change Scope And Packaging Process

1. Every change must declare scope before editing:
   - packages and routes touched
   - boundary constraints
   - tests to add or update
2. Keep changes additive and migration-friendly.
3. Separate behavior changes from structural refactors whenever possible.
4. Do not mix unrelated formatting churn with logic changes.
5. Keep files within target size:
   - preferred: 300-500 lines
   - split review: over 550 lines
   - exception note required: over 800 lines

Issue-tracking process:

1. Use `.tracker/issues/*.md` for non-trivial bugs, review findings, regressions, and deferred cleanup.
2. Treat `KNOWN_ISSUES.md` as generated output only; do not hand-edit it.
3. Create issues with `pnpm issue:new`.
4. When work starts, update the issue status/owner metadata in the issue file.
5. When work is fixed, close it with `pnpm issue:close --id <ID> ...`, then regenerate with `pnpm issue:generate`.
6. CI enforces dashboard sync with `pnpm issue:check`.

## 3. Dependency Boundary Process

Enforce dependency direction continuously:

1. `packages/core` may import only `packages/shared` and `packages/levels`.
2. `packages/formats` may import only `packages/shared` and `packages/levels`.
3. `packages/solver` may import only `packages/core` and `packages/shared`.
4. `packages/solver-kernels` may import only `packages/solver`, `packages/core`, and `packages/shared`.
5. `packages/worker` may import only `packages/solver`, `packages/solver-kernels`,
   `packages/core`, `packages/shared`, and `packages/benchmarks`.
6. `packages/benchmarks` may import only `packages/solver`, `packages/core`, and `packages/shared`.
7. `apps/web` imports package code only through public entrypoints (`src/index.ts` exports).
8. `packages/embed` is an adapter package; it may import React and package public entrypoints,
   and bundles React as a dependency (not peer dependency) for self-contained embedding.
9. Adapters (`apps/web/app/ui`, `apps/web/app/routes`, `apps/web/app/canvas`) must never access persistence directly.
10. Persistence adapters in `apps/web/app/infra/persistence` must not import adapter folders.

Process requirements:

1. Maintain TypeScript project references (`tsc -b`).
2. Keep `boundary-rules.mjs` as the single source for boundary direction/path rules.
3. Keep `eslint.config.ts` and `dependency-cruiser.config.mjs` derived from `boundary-rules.mjs`.
4. Maintain ESLint boundary rules (`no-restricted-imports` and related boundary checks).
5. Treat any boundary violation as release-blocking.

## 4. Web App Structure Process

Routing and ownership model:

1. Use Remix route modules as the primary routing model (`apps/web` in Remix Vite mode).
2. Keep route modules thin and colocate route-specific helpers by feature.
3. Route folder pattern:
   - `apps/web/app/routes/<route>.tsx`
   - optional `controller.ts`
   - optional `selectors.ts`
4. Page folders own page-specific selectors/thunks/controllers.
5. Cross-cutting slices live in `apps/web/app/state`:
   - `gameSlice`
   - `solverSlice`
   - `benchSlice`
   - `settingsSlice`
6. Add route-level `ErrorBoundary` exports for each route.
7. `/lab` is the current route-local tool surface: keep authored text, preview state, and
   one-click worker status inside `LabPage` until a concrete cross-route workflow needs shared
   store ownership.

Rendering process:

1. Keep canvas rendering split:
   - `buildRenderPlan(state)` as pure deterministic logic (unit-tested).
   - `draw(ctx, plan)` as thin imperative drawing.
2. Keep `RenderPlan` serializable and stable-order.
3. Use RAF loop orchestration; do not use React re-render loops for animation frames.

Redux state process:

1. Keep Redux state/actions JSON-serializable by default.
2. Keep typed arrays in runtime caches/ports, not in slices.
3. Any serializableCheck exception must be narrowly scoped and documented.
4. Do not move `/lab` editor/preview/run state into Redux by default; route-local state + direct
   ports is the current architecture until an ADR changes it.

## 5. Solver And Worker Process

Solver process:

1. Keep solver deterministic and side-effect free.
2. Use push-based search transitions.
3. Maintain canonical direction encoding:
   - `Direction = 'U' | 'D' | 'L' | 'R'` (engine/solver/output use uppercase)
   - `knownSolution` may be mixed-case UDLR/udlr for round-trip fidelity, but internal
     solver output and replay always use uppercase-only directions and treat knownSolution
     as direction-only after normalization
4. Expand push sequences to full UDLR walk+push strings in the solver (UDLR BFS order).
5. Keep algorithm recommendation flow deterministic:
   - `analyzeLevel(levelRuntime)`
   - `chooseAlgorithm(features)`
6. Allow UI override, but always store selected algorithm in result metadata.
7. Prefer explicit `context.nowMs` injection for solver timing. `solve(...)` may use
   `globalThis.performance.now()` as a fallback only when callers omit `nowMs`, and must surface
   an explicit error when no monotonic clock is available.

Worker process:

1. All run-scoped worker messages include `protocolVersion` and `runId`;
   lifecycle `PING`/`PONG` include `protocolVersion` only.
2. Validate messages on both sides using shared schemas.
3. Keep progress throttling solver-owned; worker runtimes request cadence through solver context
   instead of layering a second runtime throttle.
4. Support cancellation and budget enforcement.
5. SOLVE_PROGRESS may include bestPathSoFar (fully expanded UDLR).
6. SOLVE_RESULT metrics include pushCount and moveCount.
7. Disallow `SharedArrayBuffer` and `Atomics`.
8. Create workers only from client modules (`*.client.ts`); no dynamic-import escape hatches for worker construction.
9. Keep optional solver-kernel delivery app-owned: Remix/Vite adapters may seed
   `globalThis.__corgibanSolverKernelUrls` from `VITE_SOLVER_KERNEL_*` env vars before importing
   worker runtime bootstrap modules; worker preload stays best-effort and TS kernels remain fallback.
10. Use supported module worker constructor patterns:

- package-internal default:
  `new Worker(new URL("../runtime/solverWorker.ts", import.meta.url), { type: "module" })`
- app adapter url import (Remix/Vite):
  `import solverWorkerUrl from "./solverWorker.client.ts?worker&url";`
  `new Worker(solverWorkerUrl, { type: "module", name: "corgiban-solver" })`

11. Worker pool runs one active solve per worker; additional runs queue.
12. Track health:

- solver: `idle | healthy | crashed`
- bench pool health tracked similarly

13. On `worker.onerror` or `worker.onmessageerror`:

- set crashed state
- surface retry UI
- recreate worker client via retry action

## 6. Persistence And Benchmark Process

1. Keep benchmark model and `DB_VERSION` in `packages/benchmarks`.
2. Keep migration logic in `apps/web/app` persistence adapter.
3. Add unit tests for upgrade paths on schema changes.
4. Enforce retention policy:
   - default cap: 100 stored runs
   - configurable
   - clear storage action available in bench settings
5. Call `navigator.storage.persist()` when adapter initializes (feature-detected).
6. Record storage persistence result in diagnostics; log only in dev/debug.
7. Keep benchmark repeatability:
   - default pool size: `max(1, min(4, (hardwareConcurrency || 4) - 1))`
   - optional warm-up runs (discard warm-up outputs)
   - store full solver options per result
8. If persistence degrades to `memory-fallback`, keep that mode sticky until storage is recreated
   so diagnostics and behavior stay deterministic.

## 7. Input Validation And Safety Process

Shared constraints must be defined once in `packages/shared/src/constraints.ts` and reused across parser/importer/core:

1. `MAX_GRID_WIDTH = 64`
2. `MAX_GRID_HEIGHT = 64`
3. `MAX_BOXES = 40`
4. `MAX_BENCH_SUITE_LEVELS = 200`
5. `MAX_IMPORT_BYTES = 1_048_576`

Validation process:

1. Reject malformed level rows with descriptive errors.
2. Check import payload size before `JSON.parse`.
3. Validate parsed JSON with strict schemas and reject unknown keys.
4. Never ignore unknown config fields silently.
5. External format adapters must follow ADR-0010 normalization rules (no trim, open-puzzle
   handling, variant detection, tab rejection).

## 8. Tooling, CI, And Definition Of Done

Required scripts:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test`
4. `pnpm test:coverage`
5. `pnpm test:smoke`
6. `pnpm dev`
7. `pnpm build`
8. `pnpm style:check` when touching `apps/web` styling primitives, tokens, or Tailwind theme wiring

Formatting and lint ownership:

1. Prettier owns formatting.
2. ESLint owns correctness and policy checks.
3. Disable formatting overlap with `eslint-config-prettier`.
4. `apps/web` styling rules live in `apps/web/app/styles/README.md`; use semantic Tailwind
   utilities backed by tokens and verify them with `pnpm style:check`.

CI gates on every PR:

1. format:check
2. style:check
3. issue:check
4. typecheck
5. lint
6. test coverage thresholds
7. Playwright smoke (`pnpm test:smoke`)
8. boundary checks
9. encoding policy check (UTF-8 without BOM, ASCII-only text except allow list, no smart punctuation unless allowlisted)

Encoding policy enforcement runs in CI and pre-commit; pre-commit is a convenience, CI is the source of truth.

Pre-commit process:

1. run staged ASCII normalization (`pnpm exec tsx tools/scripts/normalize-ascii.ts --staged`)
2. run format:check
3. run the staged-file style-policy check (`pnpm exec tsx tools/scripts/style-policy-check.ts`)
4. run affected tests with deterministic selection strategy
5. run encoding policy check (UTF-8 without BOM, ASCII-only text except allow list, no smart punctuation unless allowlisted)
6. run lint and typecheck as local verification before PR (CI enforces both)

Completion checklist per feature:

1. Boundary rules satisfied.
2. New behavior covered by deterministic tests.
3. Documentation updated where architecture/protocol/state model changed.
4. No unresolved TODOs in changed code unless explicitly tracked.
5. `.tracker/issues/*.md` and `KNOWN_ISSUES.md` are updated when bugs/debt are created, deferred, or closed.

## 9. Documentation And ADR Process

1. Update `docs/Architecture.md` for cross-cutting architecture changes.
2. Update `docs/project-plan.md` when phase gates or acceptance criteria change.
3. Update `docs/dev-tools-spec.md` when boundary/tooling config names or enforcement rules change.
4. Add ADR in `docs/adr/` when decision is costly to reverse:
   - protocol semantics/versioning
   - state representation
   - persistence schema model
   - versioned benchmark/export artifact contracts
   - optional subsystem delivery or feature-flag strategy
   - routing/state-management paradigm shifts
5. Keep package-level README files concise and boundary-focused.
6. Keep generated docs in generated-doc paths only and do not hand-edit generated outputs.

## 10. Implementation Phase Gates

Use these phase gates from `docs/project-plan.md`:

1. Phase 0: scaffold, boundaries, scripts, and governance docs.
2. Phase 1: levels + deterministic core engine + constraints.
3. Phase 2: web parity, routing, state ownership, render plan split.
4. Phase 3: worker protocol + baseline solver + worker recovery.
5. Phase 4: benchmark execution + persistence + diagnostics.
6. Phase 5: quality hardening + offline support.
7. Phase 6: adapters, tooling, and performance expansions.
8. Phase 7: UX and route-responsibility pass across `/play`, `/lab`, and `/bench`.
9. Phase 8: solver optimization and advanced search (planned).
10. Phase 9: UI/visual polish and sprite pass.
11. Phase 10: browser-dev tools workspace for `/lab` (Sandpack/WebContainers, feature-gated).
12. Phase 11: Race Mode and multi-runner play (planned).

Do not start a later phase until earlier acceptance checks pass for the affected subsystem.

## 11. Optional Package And Feature-Flag Process

### 11.1 Introducing optional packages

Use this process for optional packages such as `packages/embed` and `packages/solver-kernels`:

1. Declare the package purpose and target phase in `docs/project-plan.md`.
2. Add/update boundary rules in `boundary-rules.mjs` and mirror the intent in:
   - `docs/Architecture.md`
   - `docs/dev-tools-spec.md`
3. Add package entrypoint and README with:
   - public API
   - allowed imports
   - known constraints (determinism/perf/security)
4. For `packages/embed`, default to Shadow DOM with scoped stylesheet injection, and treat React
   as a dependency (self-contained runtime), not a peer dependency.
5. For `packages/solver-kernels`, keep TS as the baseline path and promote to Rust + `wasm-pack`
   only with benchmark evidence. Load WASM lazily in workers with `instantiateStreaming` fallback.
6. Ensure worker client entry modules that construct workers use `*.client.ts` naming so SSR
   boundaries are enforceable at build/lint time.
7. Keep integration additive; optional heavy capabilities stay off by default until acceptance
   criteria are met.
8. Add unit/integration tests in the same change that introduces behavior.

### 11.2 Feature-flagging heavy/optional technology

Use feature flags for optional/heavy capabilities such as the `/lab` Dev Tools workspace,
WebContainers, and WASM kernels:

1. Default flags to OFF in production until explicitly approved.
2. Load heavy dependencies lazily (route-level or dynamic import), not in base app startup path.
3. Provide fallback behavior when a flag is off or unsupported (browser capability checks).
4. Gate WASM promotion behind benchmark evidence; keep TS baseline path available.
5. Treat flag rollout/removal as documented changes:
   - update docs when flag semantics change
   - add test coverage for ON/OFF behavior
6. Keep the support/fallback matrix current in:
   - `docs/Architecture.md` (runtime support posture)
   - `docs/project-plan.md` (phase and implementation commitments)
7. Browser dev environments (Sandpack/WebContainers) must remain optional tooling:
   - `/lab` feature only
   - not required for normal play/solve/bench usage
