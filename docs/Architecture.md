# Architecture

**Project:** Corgiban (Sokoban-style puzzle game)  
**Target stack:** Remix + React + TypeScript + TailwindCSS + Web Workers  
**Primary goals:** multiple solver algorithms, benchmark/testing UI, and **95%+ unit test coverage** enforced in CI.

---

## 1. North Star

### 1.1 Product outcomes

- A responsive browser game UI (keyboard, tap/click, and swipe board controls) with:
  - deterministic gameplay, undo/redo, restart, per-level progress
  - copyable move-list history plus replay
  - solution playback (step-by-step animation)
- A solver subsystem that:
  - supports multiple algorithms (BFS/A*/IDA*/Greedy/Tunnel-Macro/PI-Corral)
  - runs off-main-thread using Web Workers
  - streams progress (metrics + intermediate best solution)
  - supports cancellation, timeouts, and memory limits
- A benchmark/testing page that:
  - runs suites across many levels and algorithms
  - captures metrics (time, nodes, memory estimates, success/fail)
  - persists results locally (IndexedDB)
  - renders charts/tables and allows comparison across runs

### 1.2 Non-functional requirements

- **Correctness-first:** game engine is deterministic and pure (no DOM access).
- **Performance:** main thread never blocked by solver work.
- **Testability:** core + solver designed for unit testing with >95% coverage gates.
- **Enterprise structure:** explicit boundaries, versioned protocols, and decision records.
- **Maintainability:** incremental solver improvements without rewriting UI.

---

## 2. Reference from the current implementation

The current app uses a shared app shell above route-scoped surfaces. The primary `/play` route is
organized around:

- a **side panel** (level label, restart/next-level controls, solved-state summary, copyable move-list action),
- a **board section** (level metadata, responsive canvas rendering, solved-state banner),
- a **bottom controls** section (sequence input),
- a **solver panel** (recommendation, run/cancel, progress, replay/apply actions).

The board accepts keyboard input plus adjacent-tile tap/click and swipe gestures, and `/`
redirects directly to `/play` so gameplay remains the default entry surface.
On small screens, `/play` promotes the board to the dominant surface and collapses secondary
controls into compact mobile-specific layouts.

---

## 3. Key architectural decisions

### 3.1 Repository structure: **pnpm workspaces monorepo**

**Decision:** Use a monorepo with multiple packages and a single web app.

**Why**

- Enforces boundaries (UI cannot accidentally import worker internals).
- Allows independent unit tests/coverage per package.
- Keeps solver/core code reusable (including potential future CLI runners).

See ADR-0002 (`docs/adr/0002-monorepo-boundary-enforcement-strategy.md`).

### 3.2 Architecture style: **Hexagonal / Ports & Adapters**

**Decision:** The game domain (engine + solver) is pure and isolated. The UI and worker are adapters.

**Why**

- Prevents UI concerns from leaking into core logic.
- Makes worker vs non-worker execution a runtime choice (port).

### 3.3 Worker design: **Module Web Worker + versioned message protocol**

**Decision:** Use `type: "module"` worker entry and a versioned, runtime-validated message schema.

**Why**

- Bundler-friendly, modern browser support, easy ESM sharing.
- Protocol validation prevents silent runtime breakage.

See ADR-0003 (`docs/adr/0003-worker-protocol-versioning-validation.md`).

### 3.4 Solver action model: **Push-based search graph**

**Decision:** Solvers operate on _push_ transitions (macro moves), expanding to player path steps for playback.

**Why**

- Standard approach for Sokoban; step-based search explodes branching.
- Enables strong pruning (reachability + deadlocks).

See ADR-0004 (`docs/adr/0004-push-based-solver-model.md`).

### 3.5 State representation: **Static + dynamic split**

**Decision:** Levels are represented as:

- `staticGrid`: walls + targets (immutable)
- `dynamicState`: player position + box positions

**Why**

- Faster hashing and equality checks for solver.
- Cleaner win detection and rendering.

### 3.6 UI state management: **Redux Toolkit (RTK)**

**Decision:** Use Redux Toolkit for app state (game, UI, solver runs, benchmarks).

**Why**

- Serializable actions enable replay/debugging/benchmark reproducibility.
- Strong ecosystem for testing and devtools.
- Supports enterprise patterns (slice ownership, middleware, instrumentation).

### 3.7 Testing stack: **Vitest + RTL + Playwright**

**Decision**

- Unit tests: Vitest
- Component tests: React Testing Library (RTL)
- E2E smoke tests: Playwright (small number; unit coverage remains primary)

**Coverage gates**

- Global >= 95% for lines/branches/functions/statements
- Higher thresholds for `core` and `solver` packages (target 98-100%)

### 3.8 App shell strategy: **Remix-first from Phase 0**

**Decision:** `apps/web` is a Remix app from the start, using Remix in Vite mode.

**Why**

- Uses Remix routing/data boundaries consistently across all product surfaces.
- Avoids later migration from SPA routing to Remix conventions.
- Keeps domain packages independent of framework choice while standardizing app shell behavior.
- Consumes workspace packages as TypeScript source imports with no app-runtime prebuild step.
- Provides one app toolchain for route/client bundling, including module workers.

See ADR-0001 (`docs/adr/0001-remix-first-app-shell-vite-mode.md`).

### 3.9 Embed adapter strategy: **Shadow DOM + self-contained runtime**

**Decision:** `packages/embed` uses Shadow DOM by default, injects a scoped stylesheet artifact into
its shadow root, and bundles React as a dependency (not a peer dependency).

**Why**

- Embeds must remain stable under arbitrary host-page CSS.
- Canvas rendering is naturally isolated; only surrounding chrome needs controlled styles.
- A self-contained runtime works on non-React hosts and avoids host version coupling.
- Embed level resolution is deterministic: a known built-in `level-id` takes precedence, `level-data`
  is used only when the id is missing or unknown, and unresolved inputs surface an explicit invalid
  state instead of silently falling back.

See ADR-0006 (`docs/adr/0006-embed-shadow-dom-styling-delivery.md`).

### 3.10 WASM kernel strategy: **Rust + wasm-pack behind TS interface**

**Decision:** `packages/solver-kernels` remains TS-first and promotes hotspots to Rust +
`wasm-pack` only after benchmark evidence. `apps/web` owns optional kernel URL wiring for worker
bootstraps, accepts only absolute or app-root-relative kernel URLs, normalizes accepted values to
absolute URLs before bootstrap, and worker runtimes preload configured WASM kernels best-effort via
`fetch` + `WebAssembly.instantiateStreaming` with fallback to `WebAssembly.instantiate`. The
current Phase 6 baseline lands delivery/preload groundwork only; solve and bench execution still
run through the TS solver path until a later runtime-integration phase is benchmark-proven.

**Why**

- Keeps early phases simple and testable while preserving a high-performance path.
- Avoids base-bundle bloat by loading kernels only when needed.
- Preserves stable TS boundaries so worker protocol and UI contracts stay unchanged.

See ADR-0021 (`docs/adr/0021-solver-kernel-delivery-preload-contract.md`).

---

### 3.11 Level format interop: **CORG canonical + formats adapters**

**Decision:** Keep the internal CORG encoding canonical and introduce a dedicated
`packages/formats` package for XSB/SOK/SLC import/export.

**Why**

- Preserves the deterministic core encoding and avoids bloating `core/encoding`.
- Enables broad Sokoban ecosystem compatibility through explicit adapters.
- Keeps format parsing/normalization separate from engine rules and solver logic.

See ADR-0010 (`docs/adr/0010-level-format-interop-policy.md`).

### 3.12 Benchmark cancellation semantics: **queue-cancel + suite dispose**

**Decision:** Keep queue cancellation run-scoped (`cancel(runId)`) and use suite-level disposal
for in-flight benchmark cancellation, guarded by suite generation checks to drop stale callbacks.

**Why**

- `/bench` needs deterministic suite-level cancellation without protocol-level cancel messages.
- Generation guards prevent stale progress/result updates after cancel/dispose.

See ADR-0014 (`docs/adr/0014-benchmark-worker-cancellation-semantics.md`).

### 3.13 Protocol validation optimization: **strict default + scoped light-progress**

**Decision:** Keep strict runtime validation as default and allow an optional `light-progress`
mode for high-frequency `SOLVE_PROGRESS` payloads only.

**Why**

- Preserves structural protocol safety while reducing avoidable hot-path validation overhead.
- Keeps protocol version unchanged for a runtime-only optimization path.

See ADR-0015 (`docs/adr/0015-worker-progress-light-validation-mode.md`).

### 3.14 Benchmark report contract: **history export model + versioned strict report parsing**

**Decision:** Keep benchmark report export as a typed/versioned history artifact in Phase 4, and
enforce strict run-record validation on import.

**Why**

- Keeps export/import behavior explicit without implicit shape guessing.
- Preserves comparability by validating per-run solver options and metrics structure.
- Allows forward evolution through explicit `version` + `exportModel` checks.

See ADR-0016 (`docs/adr/0016-benchmark-report-contract-versioning.md`).

### 3.15 Offline shell strategy: **Workbox navigation caching + env-gated dev registration**

**Decision:** Use `vite-plugin-pwa` with Workbox runtime caching for document navigations, register
the service worker in production by default, and allow explicit dev enablement via
`VITE_ENABLE_PWA_DEV=1` for local manual validation.

**Why**

- Keeps `/play` and other route shells resilient after first successful load.
- Preserves normal local dev behavior unless offline registration is intentionally enabled.
- Centralizes manifest/service worker generation in the app build toolchain.

See ADR-0017 (`docs/adr/0017-pwa-offline-workbox-strategy.md`).

### 3.16 Solver liveness checks: **idle-only ping with deterministic timeout recovery**

**Decision:** Keep worker liveness checks protocol-compatible (`PING`/`PONG`) while hardening
solver-client behavior: `ping(timeoutMs?)` is idle-only, defaults to a bounded timeout, and marks
worker health as `crashed` on timeout/error with immediate worker termination.

**Why**

- Avoids hanging liveness checks that leave worker health ambiguous.
- Prevents ping/solve message interleaving from masking active-run state.
- Keeps crash/retry behavior deterministic under worker channel instability.

See ADR-0018 (`docs/adr/0018-solver-client-ping-liveness-timeout.md`).

### 3.17 Benchmark persistence recovery: **sticky memory-fallback until reset**

**Decision:** When repository persistence fails in `/bench`, switch to `memory-fallback` and keep
that mode sticky until storage is recreated (for example page reload).

**Why**

- Makes degraded persistence behavior deterministic and diagnosable.
- Avoids noisy repeated repository retries after failure.
- Keeps benchmark workflows usable with in-memory retention.

See ADR-0019 (`docs/adr/0019-benchmark-persistence-sticky-memory-fallback.md`).

### 3.18 Benchmark comparison snapshots: **strict suite-input fingerprint contract**

**Decision:** `/bench` comparison exports use a typed/versioned snapshot contract and only compute
deltas when measured-suite inputs match exactly through stored comparable-metadata fingerprints.

**Why**

- Prevents misleading comparisons across different solver settings, warm-up semantics, or runtime
  environments.
- Makes comparison export behavior explicit and versionable instead of relying on implicit UI-only
  assumptions.
- Keeps future comparison models additive (`comparisonModel` + version bump) rather than silently
  changing the current baseline.

See ADR-0020 (`docs/adr/0020-benchmark-comparison-snapshot-contract.md`).

### 3.19 Progress emission cadence: **solver-owned throttle + spectator-gated benchmark streaming**

**Decision:** Keep progress throttling in the solver layer and let worker runtimes request cadence
through solver context instead of applying a second runtime throttle. Benchmark worker progress
remains opt-in through spectator streaming.

**Why**

- Keeps progress cadence decisions in one place across solver and worker paths.
- Reduces duplicated hot-path throttling logic during solve/bench runs.
- Avoids unnecessary `BENCH_PROGRESS` traffic when no consumer is attached.

See ADR-0022 (`docs/adr/0022-solver-progress-throttle-ownership.md`).

### 3.20 Level Lab ownership: **route-local state + direct worker ports**

**Decision:** Keep `/lab` authoring text, parsed level metadata, preview `GameState`, and
single-run solve/bench status in route-local React state. `LabPage` creates/disposes
`SolverPort` and `BenchmarkPort` refs directly instead of extending the shared Redux store.
Shared playable-catalog publication happens only on explicit handoff actions; mount, parse, and
normal committed edits do not auto-publish a synthetic playable entry.

**Why**

- Keeps authoring/debugging state isolated from gameplay and persisted benchmark workflows.
- Avoids adding unstable draft/editor state to global Redux before cross-route handoff flows are
  defined.
- Lets the route drop stale worker callbacks by guarding on `(runId, authoredRevision)` after
  edits, imports, or cancellations.

See ADR-0023 (`docs/adr/0023-lab-route-local-state-ownership.md`) and ADR-0031
(`docs/adr/0031-session-playable-refs-and-atomic-route-handoff.md`).

### 3.21 Sprite atlas rendering: **app-owned OffscreenCanvas worker + canvas fallback**

**Decision:** Keep sprite-atlas generation in `apps/web/app/canvas` and use a dedicated auxiliary
worker with `OffscreenCanvas` only when the browser supports it. Atlas requests are keyed by
`cellSize`/DPR, cached lazily, and fall back to the existing main-thread canvas draw path on any
capability or worker failure.

**Why**

- Preserves main-thread responsiveness without turning rendering optimization into a protocol or
  domain concern.
- Keeps `buildRenderPlan(...)` + `draw(...)` as the canonical deterministic rendering contract.
- Lets unsupported browsers stay on the baseline renderer with no feature loss.

See ADR-0024 (`docs/adr/0024-offscreen-sprite-atlas-worker-fallback.md`).

### 3.22 Route store bootstrap: **stable route-scoped stores + mutable browser ports**

**Decision:** Keep `/play` and `/bench` route stores stable across SSR/hydration by creating the
store during render with mutable no-op ports, then replacing those ports with browser-backed
implementations after commit. Any render-time browser-backed external store that routes consume
(for example the session-scoped playable catalog) must expose a deterministic server snapshot and
reconcile browser session state only after hydration.

**Why**

- Keeps Remix route render pure; workers and persistence adapters are not created before mount.
- Preserves one stable store instance per route so thunk wiring and subscriptions stay explicit.
- Prevents hydration mismatches when route render depends on browser-session state such as
  temporary imported levels.
- Lets route modules own browser-resource cleanup without promoting those adapters into global
  singletons.

See ADR-0025 (`docs/adr/0025-route-store-ssr-safe-port-bootstrap.md`).

### 3.28 Playable identity and route handoff: **session-scoped playable refs + additive `levelRef`**

**Decision:** Treat exact runnable identity in the web app as a `PlayableEntry.ref`, not as
`LevelDefinition.id`. Built-ins use deterministic refs (`builtin:<levelId>`), authored/imported
session entries use opaque refs (`temp:<session-id>`), and route handoff adds `levelRef` as the
exact runnable identity while keeping legacy `levelId` for backward-compatible canonical fallback.
`/play` applies level + algorithm handoff through one atomic activation flow, `/lab` publishes only
on explicit user action, and `/bench` stores local-only exact reopen metadata while exporting
additive public `runnableLevelKey` and `comparisonLevelKey` fields for exact reopen plus stable
cross-session comparison identity.

**Why**

- Prevents edited built-ins from collapsing back to the original built-in by canonical id.
- Removes React-effect ordering from `/play` level + algorithm handoff correctness.
- Keeps `/lab` route-local authoring state isolated until the user explicitly hands it off.
- Lets benchmark history reopen or compare authored variants without silently falling back to a
  different runnable level.

See ADR-0031 (`docs/adr/0031-session-playable-refs-and-atomic-route-handoff.md`).

### 3.23 App-shell theme ownership: **root-owned pre-paint theme bootstrap**

**Decision:** Keep light/dark theme ownership in the root app shell. Resolve the initial `<html>`
class before paint from persisted browser preference with `prefers-color-scheme` fallback, and do
not duplicate theme ownership in route-scoped Redux stores.

**Why**

- Keeps theme ownership single-sourced across `/`, `/play`, `/bench`, `/lab`, `/dev/ui-kit`, and
  root error surfaces.
- Avoids hydration flash when the user prefers dark mode on first paint or hard reload.
- Keeps route-scoped Redux stores focused on gameplay, solver, and benchmark settings instead of
  app-shell concerns.

See ADR-0026 (`docs/adr/0026-app-shell-theme-ownership.md`).

### 3.24 Deployment runtime boundary: **Host-pluggable Remix server rendering**

**Decision:** Keep shared server document rendering host-neutral and isolate host-specific wiring to
thin deployment adapters.

**Why**

- The product already does its heavy work in browser workers; the host mainly serves the app shell.
- Shared server rendering in `apps/web/app/server/*` and `apps/web/app/entry.server.tsx` can be
  reused across Remix-compatible hosts.
- Route/root modules should not need host-package imports just because deployment changes.

See ADR-0027 (`docs/adr/0027-host-pluggable-remix-server-boundary.md`).

### 3.25 Deployment target: **Cloudflare Pages adapter**

**Decision:** Standardize the current deployment target on Cloudflare Pages through a thin adapter
layer that builds on the host-pluggable boundary above.

**Why**

- Cloudflare keeps DNS, custom-domain routing, and deployment in one system for
  `corgiban.elapsedgames.com`.
- The Pages adapter fits the current domain-management plan without changing browser-first app
  behavior.
- Keeping Cloudflare specifics in adapter files preserves the host-neutral app layer.

See ADR-0028 (`docs/adr/0028-cloudflare-pages-runtime-adapter.md`).

### 3.26 Route entry strategy: **play-first root redirect + specialist routes**

**Decision:** Treat `/play` as the primary product entrypoint. `/` redirects to `/play`, the shared
brand link returns there, `/bench` and `/lab` stay in the primary navigation, and `/dev/ui-kit`
remains a direct-access validation route rather than a primary workflow destination.

**Why**

- Removes a duplicated landing step before the main gameplay surface.
- Clarifies route ownership during the Phase 7 route-responsibility pass.
- Keeps developer validation UI available without promoting it to a product workflow.

See ADR-0029 (`docs/adr/0029-play-route-primary-entrypoint.md`).

### 3.27 Board visual theming: **app-local board skin registry**

**Decision:** Keep board visuals in an app-local skin registry under `apps/web/app/canvas`.
`GameCanvas`, the fallback canvas draw path, and the sprite-atlas worker resolve the same explicit
`skinId` + `mode` contract instead of inferring board visuals from CSS variables. The root app
shell owns the persisted board-skin preference and passes the resolved `skinId` into `/play` and
`/lab` preview via app-local adapter state rather than Redux.

**Why**

- Keeps light/dark board rendering aligned across main-thread draw fallback and worker-rendered
  atlases.
- Creates one durable contract for future alternate puzzle looks and sprite/image packs.
- Avoids depending on DOM/CSS state from worker code.

See ADR-0030 (`docs/adr/0030-app-local-board-skin-registry.md`).

## 4. Monorepo layout

```
/apps
  /web
    /app
      /bench
      /canvas
      /infra
        /persistence
      /lab
      /levels
      /navigation
      /play
      /ports
      /replay
      /routes
      /server
      /solver
      /state
      /theme
      /ui
      /styles
        README.md
      root.tsx
      entry.client.tsx
      entry.server.tsx
    /functions
    /scripts
    vite.config.ts   (Remix in Vite mode)
    wrangler.jsonc   (Cloudflare Pages deployment adapter)
    tailwind.config.ts
    vitest.config.ts

/packages
  /shared
    src/
      constraints.ts
      types.ts
      invariants.ts
      result.ts
  /levels
    src/
      corgibanTestLevels.ts
      levelSchema.ts
  /formats
    src/
      index.ts
      parseXsb.ts
      parseSok017.ts
      parseSlcXml.ts
      serializeXsb.ts
      normalizeGrid.ts
  /core
    src/
      model/
        cell.ts
        direction.ts
        position.ts
        level.ts
        gameState.ts
      engine/
        applyMove.ts
        applyMoves.ts
        selectCellAt.ts
        undo.ts
        restart.ts
        rules.ts
      encoding/
        parseLevel.ts
        serializeLevel.ts
      hashing/
        hash.ts
        normalize.ts
  /solver
    src/
      api/
        solverTypes.ts
        solverOptions.ts
        solverConstants.ts
        algorithm.ts
        registry.ts
        selection.ts
        solve.ts
      solution/
        expandSolution.ts
      algorithms/
        bfsPush.ts
        astarPush.ts
        idaStarPush.ts
        greedyPush.ts
        tunnelMacroPush.ts
        piCorralPush.ts
        prioritySearchCore.ts
      heuristics/
        manhattan.ts
        assignment.ts
      deadlocks/
        corners.ts
        piCorral.ts
        frozen.ts
      infra/
        frontier.ts
        visited.ts
        cancelToken.ts
        progress.ts
  /worker
    src/
      protocol/
        protocol.ts
        schema.ts
        validation.ts
      runtime/
        benchmarkWorker.ts
        solverWorker.ts
      client/
        benchmarkClient.client.ts
        solverClient.client.ts
        workerPool.client.ts
  /benchmarks
    src/
      model/
        benchmarkSchema.ts
        benchmarkTypes.ts
      runner/
        benchmarkRunner.ts
  /embed
    src/
      index.ts
      corgibanEmbed.ts
  /solver-kernels
    src/
      index.ts
      reachability.ts
      hashing.ts

/tools
  src/
    bestPracticesReport.ts
    levelDifficultyReport.ts
    stylePolicyCheck.ts
  scripts/
    rank-levels.ts
    style-policy-check.ts

/docs
  Architecture.md
  project-plan.md
  dev-tools-spec.md
  Engineering-Process-Playbook.md
  /adr
    0001-remix-first-app-shell-vite-mode.md
    0002-monorepo-boundary-enforcement-strategy.md
    ...
```

Note: This layout includes planned files/modules that may not exist yet. Always check the repo
tree (and `docs/project-plan.md`) for what is implemented in the current phase.

### 4.1 Boundary rules (enforced)

- `packages/core` imports from `packages/shared` and `packages/levels` only.
- `packages/formats` imports from `packages/shared` and `packages/levels` only.
- `packages/solver` imports from `core` and `shared` only.
- `packages/solver-kernels` imports from `solver`, `core`, and `shared` only.
- `packages/worker` imports from `solver`, `solver-kernels`, `core`, `shared`, and `benchmarks`
  only. No React.
- `packages/benchmarks` imports from `solver`, `core`, and `shared` only.
- `packages/embed` is an adapter package and imports other packages via public entrypoints.
- `apps/web` imports from all packages, but only via public entrypoints.
- Benchmark suite orchestration currently runs in `apps/web` through `BenchmarkPort` + `benchThunks`.
  Workers execute run-scoped `BENCH_START` requests and return `BENCH_PROGRESS` / `BENCH_RESULT`.
  `packages/benchmarks` owns shared benchmark contracts/schema constants and runner utilities.

Note: If `packages/formats` ever needs to depend on `core` (for solution validation or
simulation), add an explicit boundary rule and document the rationale in an ADR.

Enforcement:

- TypeScript project references + separate `tsconfig.json` per package
- `boundary-rules.mjs` as the single source for boundary rules
- ESLint `no-restricted-imports` and `boundaries` rules
- dependency-cruiser via `dependency-cruiser.config.mjs` (on-demand validation/graphing)

### 4.2 Extensions and adapters

- `packages/embed`: active Web Component adapter (`<corgiban-embed>`) with Shadow DOM and scoped
  stylesheet injection; bundles React as a dependency for self-contained host embedding.
- `packages/solver-kernels`: active TS-first kernel package. WASM promotion remains optional and
  profiling-gated; app-owned worker bootstraps may supply optional kernel URLs for best-effort
  preload before solve/bench execution.
- `/lab` route: active Level Lab surface for format parsing and worker-backed solve/bench checks.
- Browser dev environments (Sandpack/WebContainers) remain future `/lab` Dev Tools adapters for
  shareable repro sessions, editable examples, and browser workspaces; load them via dynamic
  import and feature flags only.
- `tools/`: reporting and developer tooling scripts (not runtime product logic).

---

## 5. Domain model

### 5.1 LevelDefinition (data boundary)

A level is defined in an editor-friendly and human-readable format, but compiled into an optimized runtime format.

**LevelDefinition (data)**

- `id: string`
- `name: string`
- `rows: string[]` (CORG tokens; compatible with current style)
- optional: `knownSolution?: string | null` (null = no usable known solution: absent, empty, or
  failed validation; undefined means field not present in source pre-normalization only; accepts
  `UDLRudlr` with case preserved for push markers)
- optional: tags/difficulty/author

**LevelCollection (data)**

- `id: string`
- `title: string`
- optional: description/author/email/url
- optional: maxWidth/maxHeight metadata
- `levels: LevelDefinition[]`

Row normalization: `parseLevel` handles CORG only (strips common leading whitespace and right-pads
ragged rows with spaces; spaces are floor). Empty floor accepts both `E` and literal space, and
core CORG serialization prefers literal space. External format normalization lives in
`packages/formats`.

#### 5.1.1 Format interop (packages/formats)

External adapters convert to/from CORG and emit `LevelDefinition` / `LevelCollection`.

Import rules:

- Never trim rows; ragged rows are allowed (width = max row length, pad with floor).
- Support interior empty rows via two-pass normalization.
- Accept floor aliases `-` and `_` only in converters; internal schema stays strict.
- Reject tabs by default (never store tabs internally).
- Normalize indentation via topology-aware crop (outside-void flood fill), not naive common-indent.
- Detect open/unclosed puzzles; reject by default with explicit override policies only.
- Closed-puzzle validation yields warnings by default; strict mode optional.
- Reject levels with all boxes on targets at start.
- Detect unsupported variants (numbered, multiban, hexoban, modern); reject by default with
  optional metadata carry.
- Support the documented SOK import/export subset: pre-board title/comment metadata, positive-count
  RLE, row separators, and topology-preserving normalization.

**LevelRuntime (engine)**

- `levelId`
- `width`, `height`
- `staticGrid: Uint8Array` (walls/targets/floor)
- `initialPlayerIndex: number` (index)
- `initialBoxes: Uint32Array` (indices)

Note: solver internal state nodes may store box indices as Uint16Array (grid max 64x64) for memory efficiency.

### 5.2 GameState (engine boundary)

`GameState` is deterministic. In the core package it contains:

- `level: LevelRuntime`
- `playerIndex`
- `boxes` (sorted `Uint32Array`)
- `history` (stack of reversible diffs: player prev, box moved, etc.)
- `stats` (moves, pushes, timestamps optional)

Engine internals may use typed arrays for performance, but Redux-facing state must remain
JSON-serializable (ids/plain arrays/objects only).

**Invariants**

- player never overlaps a wall
- player never overlaps a box
- boxes never overlap each other
- box positions always valid floor/target cells

All invariants are validated in unit tests and optionally in dev builds.

---

## 6. Runtime architecture

### 6.1 High-level data flow

```
[React UI] -> dispatch(action) -> [RTK reducers/thunks]
                      |                     |
                      v                     v
                [core engine]      [Ports: Solver/Benchmark/Persistence]
                      |                     |
                      v                     v
                [render canvas]   [worker clients + persistence adapters]
                                            |
                                            v
                              postMessage to solver/benchmark workers
                                           |
                                           v
                     [solver algorithms + run-scoped benchmark execution]
                                           |
                                           v
                     progress/result messages + persisted runs -> UI
```

- `/play` solve thunks route through `SolverPort`.
- `/bench` run/cancel workflows route through `BenchmarkPort` and persist through `PersistencePort`.
- `/bench` suite planning/progress aggregation/persistence writes stay on the main thread; workers
  run each benchmark case in isolation.

### 6.2 Threads and responsibilities

**Main thread**

- UI rendering (React + Canvas)
- input (keyboard, pointer, touch)
- animation playback timing
- state management (Redux)

**Worker thread(s)**

- solver execution
- benchmarks (potentially a pool of workers)
- heavy computations (heuristics, deadlocks, visited sets)
- runtime entrypoints are split by role (`solverWorker` and `benchmarkWorker`)
- optional app-owned auxiliary workers (for example sprite-atlas pre-rendering) can be used when
  supported and remain outside the versioned solver/benchmark protocol

---

## 7. Worker protocol

### 7.1 Versioning

All run-scoped messages include:

- `protocolVersion: 2`
- `runId: string` (UUID or monotonic unique)

Worker lifecycle messages (`PING`/`PONG`) include `protocolVersion` only.

### 7.2 Messages

**Main -> Worker (implemented in protocol v2 baseline)**

- `SOLVE_START` (level runtime payload + algorithm + limits)
- `BENCH_START` (benchmark run payload + algorithm + limits)
- `PING` (health check)

**Main -> Worker (deferred to a future protocol extension)**

- `SOLVE_CANCEL`
- `BENCH_CANCEL`

**Worker -> Main (implemented in protocol v2 baseline)**

- `SOLVE_PROGRESS` (throttled)
  - fields: `runId`, `protocolVersion`, `expanded`, `generated`, `depth`, `frontier`, `elapsedMs`, `bestHeuristic?`, `bestPathSoFar?`
  - `bestPathSoFar` (when present) is a fully expanded UDLR walk+push string
- `SOLVE_RESULT`
  - fields: `runId`, `protocolVersion`, `status`, `solutionMoves?`, `metrics`, `errorMessage?`, `errorDetails?`
  - when `status === "error"`, `errorMessage` is provided and `errorDetails` may be provided
  - metrics: `elapsedMs`, `expanded`, `generated`, `maxDepth`, `maxFrontier`, `pushCount`, `moveCount`
- `SOLVE_ERROR`
- `PONG`

- `BENCH_PROGRESS`
  - fields: `runId`, `protocolVersion`, `expanded`, `generated`, `depth`, `frontier`, `elapsedMs`, `bestHeuristic?`, `bestPathSoFar?`, `benchmarkCaseId?`
  - emitted only when `enableSpectatorStream === true` for the run
  - app adapters default `enableSpectatorStream` to `true` only when they attach a worker-progress
    consumer and default it to `false` otherwise
- `BENCH_RESULT`
  - fields: `runId`, `protocolVersion`, `status`, `solutionMoves?`, `metrics`, `errorMessage?`, `errorDetails?`, `benchmarkCaseId?`

See ADR-0011 (`docs/adr/0011-solver-protocol-solution-contract.md`).

### 7.3 Runtime validation

Use schema validation (example: Zod) at both ends:

- Worker rejects unknown/invalid messages with `SOLVE_ERROR`
- Client treats protocol mismatches as worker failures and enters a retryable crashed state
- Typed-array fields are validated with `instanceof` and are expected to arrive through
  structured-clone `postMessage`.
- Inbound `levelRuntime` payloads enforce structural invariants (grid shape consistency,
  in-bounds player/box indices, unique boxes, and no player-on-box overlap).
- Outbound validation supports an optional `light-progress` mode for high-frequency
  `SOLVE_PROGRESS` messages; strict mode remains the default and structural messages stay
  strict-schema validated.
- `apps/web` enables `light-progress` in solver client wiring only when
  `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1`.

### 7.4 Cancellation and timeouts

- Solver algorithms support cooperative cancellation through `CancelToken` when a cancel token is
  supplied in solver context.
- In protocol v2 baseline, in-flight cancellation from the app is handled by a hard worker reset
  in the solver client (`terminate` + recreate). `SOLVE_CANCEL` is reserved for a later protocol
  extension once the worker runtime supports interruptible in-flight runs.
- In Phase 3, `createSolverClient` is single-active-run oriented for `/play`; use `WorkerPool`
  for concurrent solve orchestration.
- Solver client liveness checks (`ping(timeoutMs?)`) are idle-only. Missing/invalid timeout input
  falls back to `DEFAULT_PING_TIMEOUT_MS` (`5_000`), and timeout/error transitions worker health
  to `crashed` with worker termination; late `PONG` does not auto-recover health. Solver dispatch
  rejects while a ping is in flight so ping/solve traffic cannot interleave.
- Progress throttling is solver-owned. Worker runtimes pass desired cadence through
  `SolveContext` (`progressThrottleMs`, `progressExpandedInterval`) instead of layering a second
  runtime throttle.
- App-level `/play` solve orchestration applies settings-backed default budgets unless caller
  overrides (`timeBudgetMs` and `nodeBudget`, initialized to `30_000` and `2_000_000` with
  defensive fallback to solver constants when invalid values are encountered).
- `timeBudgetMs` enforced in worker loop.
- `nodeBudget` optional.
- Benchmarks always run with budgets to avoid infinite searches.
- Multiple concurrent runs are supported through the worker pool: one active run per worker,
  additional runs are queued until a worker is free.
- Worker pool supports cancelling queued runs by `runId` before they dispatch.
- Worker pool cancel is queue-only.
- Benchmark suite cancellation uses pool disposal (`WorkerPool.dispose`) plus generation-guarded
  callback dispatch to prevent stale progress/result updates after cancel/dispose.
- Worker pool dispose rejects queued and in-flight tasks without waiting for running tasks to
  settle; callers should provide a worker-disposer callback when they need workers terminated.

See ADR-0013 (`docs/adr/0013-solver-cancellation-worker-reset.md`).
See ADR-0014 (`docs/adr/0014-benchmark-worker-cancellation-semantics.md`).
See ADR-0015 (`docs/adr/0015-worker-progress-light-validation-mode.md`).
See ADR-0018 (`docs/adr/0018-solver-client-ping-liveness-timeout.md`).

---

## 8. Solver subsystem architecture

### 8.1 Public solver API (package boundary)

- `AlgorithmId` registry (`bfsPush`, `astarPush`, `idaStarPush`, `greedyPush`, `tunnelMacroPush`, `piCorralPush`)
- `analyzeLevel(levelRuntime)` and `chooseAlgorithm(features)` for deterministic recommendation
  with fallback to implemented algorithms
- Current recommendation table:
  - tunnel-heavy levels -> `tunnelMacroPush`
  - dense/constrained 7+ box levels -> `piCorralPush`
  - sparse 0-2 box levels -> `greedyPush`
  - remaining 0-3 box levels -> `bfsPush`
  - remaining 4-6 box levels -> `astarPush` (default heuristic: Manhattan)
  - remaining larger levels -> `idaStarPush` (default heuristic: assignment)
- `solve(levelRuntime, algorithmId, options?, hooks?, context?)` entry point
- `SolveResult` includes:
  - `status: "solved" | "unsolved" | "timeout" | "cancelled" | "error"`
  - `solutionMoves?: string` (fully expanded UDLR walk+push string)
  - `errorMessage?: string`, `errorDetails?: string` when `status === "error"`
  - metrics: `expanded`, `generated`, `elapsedMs`, `maxDepth`, `maxFrontier`, `pushCount`, `moveCount`

### 8.2 Algorithm interface

All algorithms implement the same interface:

- deterministic given the same level + options
- reports progress through callback hooks
- uses cancel token cooperatively
- macro push sequences are expanded to full UDLR using solver-side walk reconstruction (UDLR neighbor order)

### 8.3 Core solver building blocks

- Solver-only state representation (`SolverState`) and `CompiledLevel` precomputations
  (neighbor table, dead squares, goal distances). See ADR-0009.
- Reachability computation (flood fill) to determine legal pushes
- State hashing:
  - Zobrist hash of canonical player index + boxes positions
  - transposition table for visited pruning
- Deadlock detection:
  - corner deadlocks (box in corner not on target)
  - frozen patterns (advanced; phased rollout)
- Heuristics:
  - Manhattan sum (fast baseline; default for A\*)
  - assignment/matching heuristic (stronger; default for IDA\*)

### 8.4 Determinism and reproducibility

- No `Math.random()` in solver
- Tie-breakers are stable (sorted actions)
- Solver timing prefers `SolveContext.nowMs`; when callers omit it, `solve(...)` may use
  `globalThis.performance.now()` if available. If no monotonic clock exists, the solver returns an
  explicit error instead of falling back to `Date.now()`.
- Benchmarks store solver options and algorithm version metadata

---

## 9. Benchmark subsystem architecture (web page + worker support)

### 9.1 Benchmark model

- `BenchmarkSuite`:
  - benchmark-package suite plans still use a `levelIds` field, but in the web app that field is
    populated with exact runnable level refs for execution
  - `/bench` route state stores exact execution identity as `levelRefs[]` and mirrors legacy/public
    `levelIds[]` only for compatibility, display, and import/export paths
  - list of algorithm configs
  - run count (repetitions)
  - budgets (time/node)
- `/bench` UI suite state stores `levelRefs` + `algorithmIds`; benchmark orchestration expands
  those into run plans with per-run solver options, environment metadata, and exact reopen /
  comparison identity metadata.
- `BenchmarkRunResult`:
  - solver result + metrics
  - environment snapshot: user agent, cores, build version

### 9.2 Execution

- Benchmarks run in a worker pool (configurable concurrency).
- Main thread schedules and aggregates results.
- Results persist through the IndexedDB repository when durable storage is available; repository
  failures degrade to in-memory retention for the active session (`memory-fallback` diagnostics).
- `BENCHMARK_DB_VERSION` and related schema constants are owned by `packages/benchmarks`.
- IndexedDB migration logic (`onupgradeneeded`) and migration tests live in the `apps/web` persistence adapter.
- Benchmark persistence initialization feature-detects `navigator.storage.persist()` and stores
  diagnostics (`granted | denied | unsupported`) without treating denied/unsupported as hard errors.
- Persistence diagnostics also track repository durability health
  (`durable | memory-fallback | unavailable`) and surfaced repository errors independently from
  `navigator.storage.persist()` outcomes.
- Bench orchestration records `performance.mark/measure` around solve dispatch/worker response and
  surfaces observed measure entries through a debug perf panel.

See ADR-0007 (`docs/adr/0007-indexeddb-persistence-migration-retention.md`).

### 9.3 UI

A dedicated route:

- `/bench`
  - suite builder (levels, algorithms, repetitions, warm-up repetitions, budgets)
  - run/cancel controls with progress and diagnostics panels
  - persisted results table (sortable, with reopen links into `/play` and `/lab`)
  - analytics/comparison panel (success rate + p50/p95 + baseline deltas)
  - export/import JSON for benchmark runs and level packs (File System Access API with fallback)
  - export comparison snapshots (`corgiban-benchmark-comparison`, versioned)
  - debug perf panel sourced from `PerformanceObserver` entries

### 9.4 Benchmark export artifact semantics

- Benchmark report export is a typed/versioned history artifact in the current baseline.
- Required report payload fields are:
  - `type: "corgiban-benchmark-report"`
  - `version`
  - `exportModel: "multi-suite-history"`
  - `results`
- Exported `results` correspond to the currently retained benchmark history and may include multiple
  suite runs.
- Exported run records may include additive `runnableLevelKey` and `comparisonLevelKey` fields so
  public reports preserve exact reopen identity plus stable comparison identity for
  edited/session-authored variants without exposing browser-session reopen refs.
- App-generated report exports currently also include `exportedAtIso` convenience metadata; strict
  report parsing still keys off the required contract fields above.
- Single-suite snapshot exports remain a future workflow decision.
- Comparison snapshot export is a separate typed/versioned artifact for `/bench` analytics.
- Comparison snapshot payload fields are:
  - `type: "corgiban-benchmark-comparison"`
  - `version: 2`
  - `comparisonModel: "strict-suite-input-fingerprint"`
  - `baselineSuiteRunId`
  - `generatedAtIso`
  - `suites`
  - `comparisons`
- Comparison snapshot export is enabled only when the selected baseline carries complete
  comparable metadata.
- Comparison deltas are computed only when measured-run comparable metadata matches the selected
  baseline exactly. Fingerprints include level/repetition inputs, solver options, environment
  metadata, and warm-up settings; non-comparable suites stay visible with explicit reasons and
  null deltas.
- See ADR-0016 (`docs/adr/0016-benchmark-report-contract-versioning.md`) and ADR-0020
  (`docs/adr/0020-benchmark-comparison-snapshot-contract.md`).

### 9.5 Benchmark and level-pack import/version policy

- Benchmark report and level-pack payloads are typed/versioned contracts.
- Benchmark reports require:
  - `type: "corgiban-benchmark-report"`
  - `version` (explicitly supported versions only)
  - `exportModel` (explicitly supported values only)
  - `results` entries that pass strict run-record validation
- Strict run-record validation includes required solver options and enum-like field validation
  (`algorithmId`, `status`) in addition to metrics/environment structure checks.
- Unsupported benchmark report versions/export models are rejected with explicit user-facing
  errors (no silent fallback).
- Level-pack imports require:
  - `type: "corgiban-level-pack"`
  - `version: 1`
  - payload level references via `levelIds: string[]` or `levels[].id`
- App-generated level-pack exports currently include both `levelIds` and `levels` plus
  `exportedAtIso`; imports accept either id-bearing shape. When both fields are present,
  `levelIds` is authoritative and `levels` only supplies inline definitions for referenced ids.
- Level-pack imports accept recognized built-in ids and inline custom level definitions. A
  recognized built-in id takes precedence only when any same-id inline definition matches the
  canonical built-in payload exactly.
- Accepted custom/authored levels are normalized, parsed, and kept as explicit session-scoped
  playable entries so `/play`, `/lab`, and `/bench` can reopen the exact runnable variant during
  the active browser session without mutating the built-in catalog.
- Session playable entries use opaque `levelRef` values as runnable identity; `level.id` remains
  canonical/display identity only.
- Browser-local temp/session catalog persistence is alpha-only state and may be invalidated across
  incompatible releases instead of being migrated.
- Local benchmark persistence may retain app-only exact reopen metadata (`levelRef`,
  `exactLevelKey`, `levelFingerprint`, `comparisonLevelKey`, `levelName`) so `/bench` can reopen
  session-backed levels safely while public report exports carry additive public
  `runnableLevelKey` and `comparisonLevelKey` fields.
- Current local benchmark fingerprints are derived from a compact deterministic key over the
  canonical committed `LevelDefinition` payload (`id`, `name`, `rows`, `knownSolution`). They are
  intentionally not based on raw authored text, but they are also not yet parsed-structure
  canonical; metadata-only edits can therefore invalidate a stored local reopen/comparison match.
- Browser-local exact reopen matching accepts both the current compact exact-level key and the
  legacy serialized exact-level key so older local history/handoff state remains readable during
  the key-format transition.
- Route render and hydration must treat that catalog as an external store: the server snapshot is
  built-in levels only, and the client subscribes to reconcile session-backed playable entries
  after commit.
- Legacy `levelId` fallback remains supported for built-in links and unique session matches, but it
  must not guess between multiple session entries that share the same canonical id.
- When a requested `levelRef` or legacy `levelId` cannot be resolved, `/play`, `/bench`, and
  `/lab` keep their route shells but show explicit unavailable states instead of silently falling
  back to the active level, an empty suite, or a starter Lab draft.
- Entries without a recognized built-in id or a valid inline custom definition are skipped with an
  explicit user-facing notice; extra `levels[]` entries that are not referenced by authoritative
  `levelIds` are ignored; unsupported same-`level.id` authored/session variants are rejected
  explicitly; and unsupported types/versions are still rejected.
- See ADR-0016 (`docs/adr/0016-benchmark-report-contract-versioning.md`) and ADR-0032
  (`docs/adr/0032-benchmark-level-fingerprint-scope.md`).

### 9.6 Persistence diagnostics model

- Current diagnostics include:
  - storage persistence permission outcome (`granted | denied | unsupported`)
  - repository durability health (`durable | memory-fallback | unavailable`)
  - latest persistence error/notice surfaced to the user
  - sticky degraded-mode semantics: once fallback occurs, `memory-fallback` remains active until
    storage is recreated

---

## 10. Rendering architecture

### 10.1 Canvas-first (parity with current app)

- Keep a single `<canvas>` for the board.
- React owns layout; rendering is imperative.
- The renderer consumes only `GameState` + `LevelRuntime`.

### 10.2 Rendering pipeline

- rendering draws on state or size changes (single draw per change); requestAnimationFrame is reserved for replay or future animations and can be reintroduced with a dirty flag if needed
- sprite atlases are requested lazily per `skinId`/`mode`/`cellSize`/DPR tuple and cached
- consistent coordinate system; DPR scaling supported
- Rendering is split into `buildRenderPlan(state): RenderPlan` (pure, deterministic, unit-tested)
  and `draw(ctx, plan)` (thin imperative canvas adapter).
- Board palettes resolve from an app-local board-skin registry shared by the fallback draw path
  and the sprite-atlas worker so theme-aware rendering and future sprite packs use one identity
  contract.
- OffscreenCanvas sprite-atlas pre-rendering runs in a dedicated worker when available; the
  main-thread canvas draw path remains the fallback.

See ADR-0005 (`docs/adr/0005-canvas-renderplan-split.md`).
See ADR-0024 (`docs/adr/0024-offscreen-sprite-atlas-worker-fallback.md`).
See ADR-0030 (`docs/adr/0030-app-local-board-skin-registry.md`).

### 10.3 Optional overlays (future)

- reachable cells
- deadlock highlights
- solver frontier visualization for debugging

### 10.4 Replay pipeline

- `solutionMoves` arrives as a fully expanded UDLR walk+push string.
- Replay runs in a dedicated controller using a RAF loop with a time accumulator.
- The replay `GameState` lives outside Redux (shadow state in a useRef); Redux stores only
  serializable replay metadata (state, index, totals). The move list lives in the controller
  shadow state. Replay speed is sourced from settings.

See ADR-0012 (`docs/adr/0012-replay-pipeline-shadow-state.md`).

---

## 11. UI architecture

### 11.1 Pages

- `/` (redirects to `/play`; no standalone in-app landing page)
- `/play` (interactive play surface; accepts exact `levelRef` handoffs plus legacy `levelId`
  fallback, applies level + algorithm route handoff atomically, and shows an explicit unavailable
  state when a requested handoff target cannot be resolved)
- `/bench` (benchmark suite surface with result handoff links back into `/play` and `/lab`, using
  `levelRef` when exact session identity is available and failing closed when a requested handoff
  target is unavailable)
- `/dev/ui-kit` (design system showcase; direct-access validation route, not a primary nav destination)
- `/lab` (Level Lab route with format parsing, route-local tool state, worker-backed checks, and
  explicit publish-on-click handoff actions into `/play` / `/bench`, plus unavailable-state routing
  when a requested source level is gone)
- `/tests` (optional internal harness page for interactive debugging)

### 11.2 Component structure (current)

- `Document` (shared html/head/body wrapper, pre-paint theme bootstrap, skip link, root error shell)
- `AppNav` (global navigation, play-first brand link, and light/dark theme toggle)
- `IndexRoute` (root redirect to `/play`)
- `SidePanel` (level info, restart/next level, solved-state summary, and a copyable move-list action; the older detailed move-history layout remains intentionally parked in `MoveHistory.tsx` for possible future revival)
- `GameCanvas` (responsive board canvas host)
- `BottomControls` (sequence input)
- `SolverPanel` (algorithm selection across all implemented solver ids, run/cancel, progress, replay/apply actions)
- `styles/README.md` (web styling contract for token ownership, semantic Tailwind utilities, and
  `pnpm style:check`)

---

### 11.3 Remix integration strategy

- `apps/web` uses Remix route modules and route-level boundaries from the start.
- Worker integration remains unchanged (Remix UI dispatches through the same worker clients/ports).
- Domain packages (`core`, `solver`, `worker`, `benchmarks`) remain framework-agnostic.
- Deployment/runtime specifics stay in the app deployment layer:
  `functions/[[path]].ts`, `wrangler.jsonc`, and host-specific preview/deploy scripts.
- Shared Remix document rendering lives in `app/server/*` and `entry.server.tsx`.
- Route modules stay runtime-neutral unless values are passed in through Remix load context.
- Workers are client-only: never create workers from Remix loaders/actions or server entrypoints.
- Worker creation is allowed only in `*.client.ts` modules; do not rely on dynamic-import
  escape hatches from server-reachable modules.
- Module worker construction uses one of:
  - package-internal default:
    `new Worker(new URL("../runtime/solverWorker.ts", import.meta.url), { type: "module" })`
  - app adapter url import (Remix/Vite):
    `import solverWorkerUrl from "./solverWorker.client.ts?worker&url";`
    `new Worker(solverWorkerUrl, { type: "module", name: "corgiban-solver" })`
- `apps/web` worker bootstraps may apply optional solver-kernel URLs from Vite env before loading
  worker runtime modules; accepted env values are absolute URLs or app-root-relative paths, and the
  documented host shape is `globalThis.__corgibanSolverKernelUrls`.

---

## 12. State management

### 12.1 Redux slices

- `gameSlice`
  - active playable ref plus canonical level id, move history (direction + pushed), stats
    (moves/pushes)
  - GameState is derived from history using core helpers; typed arrays stay out of Redux
- `solverSlice`
  - active run id, selected algorithm id, latest progress snapshot, last result, status,
    recommendation, workerHealth
  - replay metadata: replayState, replayIndex, replayTotalSteps
- `benchSlice`
  - suite config keyed by playable refs (with legacy level-id mirror where needed), active
    benchmark status/progress, results, diagnostics, perf entries
- `settingsSlice`
  - tileAnimationDuration, solverReplaySpeed, solver time/node budget defaults, debug flags

### 12.2 Side effects

- Use RTK thunks for:
  - starting/cancelling solver
  - benchmark scheduling
- Level changes route through a dedicated workflow thunk that cancels any active run, swaps the
  active playable ref/runtime, recomputes recommendation, and applies any valid requested
  algorithm override atomically.
- Replay scheduling is handled by `ReplayController` (RAF loop + shadow state), not by a thunk.
- Current thunks depend on injected ports at store creation:
  - `SolverPort` for `/play` solve orchestration
  - `BenchmarkPort` for `/bench` run/cancel orchestration
  - `PersistencePort` for benchmark persistence and import/export workflows
- `/play` and `/bench` route modules create stores with mutable no-op ports during render and swap
  in browser-backed ports after commit so SSR/render stays pure and browser resources are not
  created before the route mounts. This preserves one stable store instance per route; route
  modules replace ports, not store identity. See ADR-0025.
- `/play` may layer lightweight browser-local continuity on top of that route store (for example
  last-played built-in level resume and completed built-in level markers) via post-hydration
  `localStorage`
  adapters. That continuity is scoped to built-in levels only; session-scoped handoff levels from
  `/lab` or `/bench` remain one-shot route activations and must not overwrite saved built-in
  progress. This is intentionally a POC playability layer, not a replacement for the app's
  heavier benchmark persistence model.
- The root app shell may also persist an app-local board-skin preference in `localStorage`,
  restore it after hydration, and expose it through app-owned context/navigation controls for
  `/play` and `/lab` preview. Keep that visual preference outside route-scoped Redux stores.
- Render-time browser state that routes consume outside Redux follows the same rule: expose a
  deterministic server snapshot, subscribe after hydration, and do not read `sessionStorage` or
  `localStorage` directly during SSR render.
- The root app shell owns the light/dark theme class on `<html>`, resolves the initial value
  before paint from persisted preference with `prefers-color-scheme` fallback, and exposes the
  toggle through the shared app navigation. Route-scoped Redux stores do not manage theme.
- `/lab` intentionally stays outside Redux thunk orchestration; it creates route-local
  `SolverPort` / `BenchmarkPort` refs and coordinates one-click solve/bench flows directly inside
  `LabPage`.
- Port interfaces used by thunks:
  - `SolverPort`
  - `BenchmarkPort`
  - `PersistencePort`

### 12.3 Route-local tool surfaces

- `/lab` owns authored input text, parsed metadata, preview `GameState`, and single-run
  solve/bench status in local React state.
- `/lab` format switching is a route-local parse -> serialize conversion step, not a passive label
  change. The active textarea content is re-emitted in the selected format, and CORG output
  promotes to JSON when row-only text would drop level metadata.
- Successful parse/import commits bump an authored revision token so stale worker results are
  ignored after the active level changes.
- Failed parses leave the authored revision unchanged; in-flight solve/bench runs continue against
  the last successfully committed level.
- `/lab` does not publish shared playable entries on mount, parse, or ordinary committed edits.
  Explicit actions such as `Open in Play` and `Send to Bench` publish or refresh a session entry,
  reuse the same session ref within the Lab flow, and navigate via `levelRef`.
- Lab bootstraps from a full playable entry rather than a bare `LevelDefinition` so session-backed
  edits continue against the same authored identity when opened from `/play` or `/bench`.
- Route unmount disposes direct worker ports instead of relying on shared-store lifecycle.
- Promote `/lab` state into Redux only when a concrete cross-route workflow requires shared
  ownership and the change is documented in an ADR.

### 12.4 Redux serializability strategy

- Keep Redux state/actions JSON-serializable by default.
- Do not store typed arrays directly in slices; use serializable equivalents (`number[]`, ids,
  plain objects).
- Keep typed-array runtime caches outside Redux (for example in repository/port caches keyed by
  level id).
- Any serializableCheck exception must be narrowly scoped to known paths/actions and documented.

---

## 13. Testing strategy and coverage gates

### 13.1 Test categories

**Package unit tests**

- `core`: movement rules, push logic, win detection, undo/redo, parsing/encoding
- `formats`: import/export parsing, normalization, and validation warnings
- `solver`: reachability, hashing, visited behavior, algorithm correctness on small levels
- `worker`: protocol validation, cancellation, kernel preload fallback behavior, and progress
  emission semantics

**UI tests**

- component behavior (renders state, dispatches actions)
- keyboard handling and accessibility
- playback controls

**E2E smoke**

- route smoke checks for `/`, `/play`, `/bench`, `/lab`, and `/dev/ui-kit`
- `/bench` benchmark run persistence across reload plus clear-results behavior
- `/play` offline shell availability check after first load with required service worker readiness

### 13.2 Coverage targets

- Global gates: 95%+ lines/branches/functions/statements
- `core` + `solver`: 98%+ recommended
- No skipping coverage with `/* istanbul ignore */` unless justified in ADR

### 13.3 CI enforcement

- Coverage gates run on pull requests.
- PR fails if thresholds not met.
- Snapshot tests used sparingly (avoid brittle snapshots for canvas).

---

## 14. CI/CD and quality gates

### 14.1 CI pipeline (GitHub Actions)

- install (pnpm)
- format check
- style check
- known issues sync check (`pnpm issue:check`)
- typecheck (tsc -b)
- lint
- unit tests with coverage gates
- install Playwright browser (Chromium)
- Playwright smoke (`pnpm test:smoke`, production preview path, including the preview build)
- encoding policy check (UTF-8 without BOM, ASCII-only text except allow list, no smart punctuation unless allowlisted)
- Deploy target: Cloudflare Pages using `apps/web/functions/[[path]].ts` as the host adapter and
  `wrangler.jsonc` for Pages build metadata/custom-domain deployment settings. Shared document
  rendering remains host-neutral in `apps/web/app/server/*` and `entry.server.tsx`.

### 14.2 Quality gates

- ESLint + Prettier
- TypeScript strict mode
- dependency constraints per package
- bundle size budget warnings (optional)

---

## 15. Observability & diagnostics

### 15.1 Logging

- Structured logs in dev builds (tagged by subsystem: engine/solver/worker).
- Worker logs forwarded to main thread only in dev mode.

### 15.2 Metrics

- solver emits:
  - nodes expanded
  - frontier size
  - elapsed time
  - best heuristic score
  - pushCount and moveCount for solved runs
- benchmark persists metrics for comparison

---

## 16. Security considerations

- No dynamic code evaluation.
- Worker only accepts messages matching the protocol version.
- Avoid leaking large data to UI logs in production.

### 16.1 Browser support and fallback matrix (minimum)

| Capability             | Expected support posture                             | Primary path                                                   | Fallback path                                                         |
| ---------------------- | ---------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| File System Access API | Chromium-first; not universal                        | Native open/save dialogs for level packs and benchmark exports | File input + anchor-download (`Blob`/`URL.createObjectURL`)           |
| OffscreenCanvas        | Not universal across browsers/contexts               | Worker-side pre-rendering/asset prep where supported           | Main-thread Canvas renderer (`buildRenderPlan` + `draw`)              |
| PWA Service Worker     | Host/protocol dependent; varies in embedded contexts | Workbox app-shell/offline caching on supported HTTPS hosts     | No-SW network mode; app remains functional without offline guarantees |

---

## 17. ADR process

All major decisions are recorded in `/docs/adr/`.
Current accepted ADRs:

- ADR-0001: Remix-first app shell (Vite mode)
- ADR-0002: Monorepo and package boundary enforcement strategy
- ADR-0003: Worker protocol versioning and validation strategy
- ADR-0004: Push-based solver model
- ADR-0005: Canvas rendering testability via RenderPlan split
- ADR-0006: Web Component embed strategy (Shadow DOM and styling delivery)
- ADR-0007: Persistence model (IndexedDB stores, migration policy, retention)
- ADR-0008: TypeScript project references and emission policy
- ADR-0009: Solver-optimized state representation and hashing
- ADR-0010: Level format interop and import validation policy
- ADR-0011: Solver protocol solution contract and options validation
- ADR-0012: Replay pipeline shadow state and RAF scheduling
- ADR-0013: Solver cancellation via worker reset (Phase 3 baseline)
- ADR-0014: Benchmark worker cancellation semantics
- ADR-0015: Worker progress light-validation mode
- ADR-0016: Benchmark report contract and versioning policy
- ADR-0017: PWA offline shell strategy (Workbox + dev registration toggle)
- ADR-0018: Solver client ping liveness and timeout semantics
- ADR-0019: Benchmark persistence recovery via sticky memory-fallback mode
- ADR-0020: Benchmark comparison snapshot contract and strict suite-input comparability
- ADR-0021: Solver kernel delivery and best-effort worker preload contract
- ADR-0022: Solver-owned progress throttling and spectator-gated worker progress
- ADR-0023: Level Lab route-local state ownership and direct port orchestration
- ADR-0024: Offscreen sprite-atlas worker with main-thread fallback
- ADR-0025: SSR-safe route store bootstrap via mutable ports
- ADR-0026: App-shell theme ownership
- ADR-0027: Host-pluggable Remix server boundary
- ADR-0028: Cloudflare Pages runtime adapter
- ADR-0029: Play-first root entrypoint and specialist route charters
- ADR-0030: App-local board skin registry
- ADR-0031: Session-scoped playable refs and atomic route handoff

---

## 18. Implementation order (architecture-aligned)

1. Package scaffolding + boundary enforcement + CI coverage gates
2. `core` engine correctness with tests
3. React UI parity (play/restart/history) + canvas renderer
4. Worker protocol + minimal solver
5. Solver expansion (heuristics, deadlocks)
6. Benchmark page + persistence + worker pool

---
