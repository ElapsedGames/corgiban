# apps/web

Remix application containing the product UI, routes, and orchestration.

## Responsibilities

- Remix routes: `/` (redirects to `/play`), `/play`, `/bench`, `/lab`, and `/dev/ui-kit`
- Root app shell: shared navigation, skip link, light/dark theme bootstrap/toggle, branded
  document metadata, install assets, and browser theme-color sync
- UI composition (React components) and Tailwind styling
- Styling contract in `app/styles/README.md` with tokens in `app/styles/tokens.css`, mirrored in
  `tailwind.config.ts`, and enforced by `pnpm style:check`
- Route-scoped state orchestration (Redux Toolkit) and workflow/thunks
- Canvas host + animation playback scheduling (RAF time accumulator, shadow GameState outside Redux)
- Worker clients (via ports/adapters) for solver + benchmarks
- Persistence adapters (IndexedDB, File System Access export/import)
- Shared Remix server document rendering plus deployment adapters (currently Cloudflare Pages)

## Current status (Phase 7 route pass complete + Phase 9 visual polish in progress)

- Routes: `/` redirects to `/play`, `/play` remains the primary gameplay surface, `/bench` and
  `/lab` stay in the main nav, and `/dev/ui-kit` remains a direct-access validation route.
- State: route-scoped RTK stores use `game`, `solver`, `bench`, and `settings` slices where applicable; the root app shell keeps theme ownership outside Redux.
- `/play` and `/bench` use route-scoped RTK stores; `/lab` intentionally keeps authoring,
  preview, and one-click worker status local to `LabPage` and talks to worker ports directly.
- `/play` and `/bench` create those route-scoped stores with mutable no-op ports during render,
  then replace them with browser-backed worker/persistence ports after commit so SSR stays pure and
  each route keeps a stable store instance across hydration.
- The playable-level catalog follows the same SSR discipline: route render reads it through a
  hydration-safe external-store hook whose server snapshot contains built-in entries only, then the
  client reconciles current-session session entries after commit without breaking hydration.
- Session/local playable-catalog persistence is alpha-only browser state. Incompatible schema
  versions are cleared intentionally instead of being migrated forward.
- Playable identity is split deliberately: `level.id` is canonical/display identity, while
  `levelRef` / `PlayableEntry.ref` is the exact runnable identity for the current browser session.
- The root app shell owns the light/dark `<html>` class, resolves the initial theme before paint
  from persisted preference with `prefers-color-scheme` fallback, and exposes the toggle in
  `AppNav`.
- The root app shell also owns the board-skin preference for gameplay. It restores the saved
  `skinId` from `localStorage` after hydration, injects that value through app-local context, and
  exposes a board `Mode` toggle on the play-facing routes so `/play` and `/lab` preview can swap
  between the illustrated `classic` skin and the simpler `legacy` skin without routing or Redux
  changes.
- The root document also publishes the canonical site title/description, branded Open Graph /
  Twitter preview metadata, favicon + Apple touch icon links, and syncs the browser
  `theme-color` meta tag from the token layer.
- Shared navigation is play-first: the brand link returns to `/play`, while `/dev/ui-kit` is kept
  out of the primary workflow nav.
- Web styling now uses semantic Tailwind utilities backed by `tokens.css`; `pnpm style:check`
  enforces the documented `app/styles/README.md` rules on staged files in pre-commit and on tracked
  files via `--all`.
- Play:
  - `/` redirects here so gameplay is the first-load entry surface.
  - `/play` accepts route handoff search params for exact `levelRef`, legacy `levelId`, and
    optional `algorithmId`. Requested levels resolve by exact `levelRef` first and legacy
    canonical-id fallback second, so built-ins remain backward-compatible while session-authored
    variants keep distinct runnable identity.
  - When a requested exact `levelRef` or legacy `levelId` cannot be resolved, `/play` keeps the
    route shell but renders an explicit unavailable state instead of silently continuing on the
    current active puzzle.
  - `/play` route activation is atomic: the route resolves the requested playable entry, swaps the
    active runtime, recomputes the recommendation, and then applies a valid requested algorithm
    override once. This avoids recommendation recompute clobbering the requested algorithm during
    combined handoffs.
  - GameState is derived from move history using core helpers.
  - Canvas rendering can use OffscreenCanvas sprite-atlas pre-rendering via a worker when
    supported, with main-thread draw fallback.
  - Board visuals resolve through the app-local `boardSkin.ts` registry so light/dark palettes and
    future skin ids stay aligned across the fallback draw path and sprite-atlas worker cache.
  - The current board visuals ship two app-local skins:
    - `classic`: illustrated hedges, bone crates, and corgi player art
    - `legacy`: the simpler geometric fallback look
      Both skins use the same `skinId` + `mode` contract in the fallback canvas path and the worker
      atlas path.
  - `GameCanvas` clamps its effective cell size to the available container width so small screens
    keep the board inside the route layout without distorting the render contract.
  - The board accepts keyboard input plus adjacent-tile click/tap and swipe gestures through a
    main-thread pointer adapter bound to the rendered canvas node.
  - When the current puzzle is solved, `Enter` advances to the next level, and narrow viewports
    auto-scroll the board into view before replay animation starts.
  - Small screens make the board full-bleed, trim the visible side-panel and solver actions to the
    primary gameplay controls, and lock the mobile `Run Solve` action after non-success solver
    outcomes until the player changes levels.
  - Solver panel runs/cancels solves, shows progress, can animate results, and exposes the full implemented algorithm set with shared friendly labels (`BFS Push`, `A-Star Push`, `IDA-Star Push`, `Greedy Push`, `Tunnel Macro Push`, `PI-Corral Push`).
  - Settings include default solver budgets (time/node), and `/play` solve orchestration uses those defaults with defensive fallback to solver constants.
  - `/play` also keeps lightweight browser-local player continuity (`lastPlayedLevel` plus completed built-in level ids) in `localStorage`, but only for built-in levels. Lab/Bench handoff levels stay one-shot session views: they do not overwrite saved built-in continuity, and once an exact session handoff has been applied the exact route params are cleared so refresh falls back to saved built-in progress or level 1. Canonical built-in `/play?levelId=...` links stay shareable. This is intentionally a small POC playability layer so the final proof of concept feels more like a game, without expanding the heavier IndexedDB benchmark persistence model into general gameplay state yet.
  - `/play` still does not accept a durable public custom-puzzle URL contract such as
    `levelData=...` or a saved puzzle id. Custom/authored puzzle links still depend on session
    handoff state from `/lab` or `/bench`; durable URL-fed custom puzzle loading is deferred in
    `DEBT-015`.
  - The current `/play` surface does not render the old detailed move-history card/list UI. Instead it exposes move history as a copyable UDLR move-list action (`Copy Move List`) while Redux/core still retain full move history for gameplay, replay, and persistence workflows.
  - The older detailed move-history layout remains intentionally parked in `app/play/MoveHistory.tsx` as a commented reference for possible future revival. Treat that parked block as an intentional product note, not as live shipped UI.
  - Optional env toggle: `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1` enables light validation mode for high-frequency `SOLVE_PROGRESS` messages in the solver client; strict mode remains default.
  - Optional solver-kernel env wiring:
    `VITE_SOLVER_KERNEL_REACHABILITY_URL`, `VITE_SOLVER_KERNEL_HASHING_URL`, and
    `VITE_SOLVER_KERNEL_ASSIGNMENT_URL` seed worker bootstrap config for best-effort WASM preload.
    Values must be absolute URLs or app-root-relative paths; accepted values are normalized to
    absolute URLs before bootstrap. Failed loads fall back to TS kernels without blocking
    solve/bench flows.
- Bench:
  - `/bench` renders suite builder, run/cancel controls, diagnostics, persisted results, and import/export controls.
  - When a requested exact `levelRef` or legacy `levelId` cannot be resolved, `/bench` keeps the
    route shell but renders an explicit unavailable state instead of silently loading a different
    suite or the default builder selection.
  - `/bench` exposes the same six friendly solver labels as `/play` when building suites.
  - Warm-up repetitions are configurable; warm-up runs execute but are excluded from measured persisted result history.
  - Analytics/comparison panel provides success rate and p50/p95 elapsed-time summaries plus
    versioned comparison snapshot export; deltas are computed only when stored comparable metadata
    (solver options, environment, and warm-up settings) matches the selected baseline exactly.
    Export stays disabled only when the selected baseline lacks comparable metadata; non-comparable
    suites remain visible with explicit reasons and null deltas.
  - Bench workflow uses injected ports (`BenchmarkPort`, `PersistencePort`) via thunks; UI components do not call persistence adapters directly.
  - Route composition creates the browser-backed persistence adapter through `app/ports/persistencePort.client.ts`, keeping `app/infra/persistence` behind the port boundary.
  - Worker-level benchmark progress streaming is spectator-only and adapter-gated; `/bench`
    enables spectator stream automatically when a per-run worker-progress consumer is attached,
    defaults it to `false` otherwise, and still allows explicit overrides when needed.
  - Persistence initialization feature-detects `navigator.storage.persist()` and records diagnostics (`granted | denied | unsupported`), with console logging only in dev+debug mode.
  - Diagnostics also surface repository durability health (`durable | memory-fallback | unavailable`) independently from `storage.persist()` outcomes; `memory-fallback` is sticky until storage reset/recreation.
  - Performance instrumentation (`performance.mark/measure`) is observed via `PerformanceObserver` and rendered in a debug perf panel.
  - File System Access API export/import is feature-detected with fallback to anchor download and file input.
  - Level-pack import requires a versioned contract (`type` + `version`) and may reference
    recognized built-in ids or inline custom level definitions. When both `levelIds` and `levels`
    are present, `levelIds` is authoritative and `levels` only supplies inline definitions for
    referenced ids.
  - Accepted imported/authored levels are normalized, validated, and stored as explicit session
    playable entries for the current browser session. Built-ins use deterministic refs
    (`builtin:<levelId>`); authored/imported session entries use opaque refs (`temp:<...>`).
    Imported packs are materialized as app-owned temporary session collections so pack order and
    next/previous navigation stay scoped to the imported pack instead of merging into the built-in
    catalog. Hard reloads still hydrate safely because routes render against the built-in snapshot
    first and reconcile session entries after commit.
  - Recognized built-in ids win over same-id inline definitions only when the inline payload is the
    same canonical built-in definition. Packs that would collapse same-`level.id` authored/session
    variants are rejected explicitly instead of being deduplicated silently. Malformed/unrecognized
    referenced entries are still skipped with a notice, and unused extra `levels[]` entries are
    ignored.
  - App-generated benchmark report exports include `exportedAtIso` convenience metadata; app-
    generated level-pack exports include both `levelIds` and `levels` plus `exportedAtIso`, but
    export rejects selected same-`level.id` authored/session variants that the canonical-only pack
    format cannot preserve exactly.
  - Benchmark history rows hand a stored level back to `/play` or `/lab` only when an exact reopen
    target can still be resolved. If the session entry is gone or its exact key no longer matches,
    the row degrades to `level unavailable` instead of reopening a canonical built-in fallback.
  - Public benchmark exports/imports now include an additive `runnableLevelKey` for exact reopen
    identity plus `comparisonLevelKey` for stable comparison identity across import/export.
    App-local exact reopen metadata is still retained only in local persistence and stripped from
    public export payloads.
  - The local reopen/comparison fingerprint is derived from a compact deterministic key over the
    canonical committed `LevelDefinition` payload (`id`, `name`, `rows`, `knownSolution`) rather
    than raw editor text.
    Metadata-only changes can therefore make an old local result unavailable; refining that
    behavior to parsed-structure equivalence is deferred work tracked by ADR-0032.
  - Exact reopen matching also accepts the older serialized exact-level keys so pre-hash browser-
    local benchmark metadata and route handoff state remain readable while the app migrates toward
    the compact key format.
- Lab:
  - `/lab` provides a CORG-first authoring surface plus format-aware single-level parsing
    (CORG/XSB/SOK/SLC), canvas preview, and one-click worker solve/bench checks. Multi-level
    XSB/SOK/SLC payloads are rejected with an explicit error so the editor always operates on one
    committed level at a time.
  - Preview / Play reuses the same adjacent-tile click/tap and swipe controls as `/play`, while
    keeping preview moves local to the authored level state.
  - Changing the format selector converts the current authored text through validated parse ->
    serialize steps instead of only relabeling the textarea. When CORG row text would lose level
    metadata, the route promotes the authored text to CORG JSON so `id`, `name`, and
    `knownSolution` survive the conversion.
  - Lab import/export uses a strict versioned JSON payload contract (`corgiban-lab-level`,
    version `1`): required `type`, `version`, `format`, and `content`; optional
    `exportedAtIso`; unknown top-level fields are rejected on import.
  - Successful parse/import commits advance an authored-input revision so stale solve/bench
    callbacks are ignored after the active level changes.
  - Failed parses leave the committed level and authored revision untouched, so in-flight
    solve/bench work continues against the last successful parse.
  - `/lab` does not auto-publish on mount or parse. Explicit actions such as `Open in Play` and
    `Send to Bench` publish or refresh a session playable entry for the committed level, preserve
    any imported-pack collection metadata, and navigate using exact `levelRef` plus additive
    `levelId` fallback metadata.
  - When a requested exact `levelRef` or legacy `levelId` is unavailable, `/lab` keeps the page
    shell but renders an explicit unavailable state instead of dropping into the starter editor.
  - Lab can boot from a handed-off `levelRef` or legacy `levelId`; bootstrapping uses the full
    playable entry so editing can continue against the same authored session identity.
- Offline/PWA:
  - `vite-plugin-pwa` in `vite.config.ts` owns manifest and service-worker generation; keep the
    manifest source of truth there instead of maintaining a duplicate file under `public/`.
  - The generated manifest follows the play-first route contract with `start_url: '/play'` and
    `scope: '/'`.
  - App-owned install assets now include dedicated PNG icons (`icon-192.png`, `icon-512.png`) and
    `apple-touch-icon.png`; the branded social preview card is served from `public/social-card.png`.
  - Workbox-backed service worker registration is enabled in production builds.
  - Dev-only PWA worker registration can be enabled with `VITE_ENABLE_PWA_DEV=1` for local smoke validation.
- Hosting/deploy:
  - Browser gameplay, solver, benchmark, and persistence logic remain client-side and host-agnostic.
  - `app/server/*` and `app/entry.server.tsx` define the shared Remix document-render path.
  - `apps/web/functions/[[path]].ts`, `wrangler.jsonc`, and `preview:cloudflare` /
    `deploy:cloudflare` scripts form the current Cloudflare Pages adapter layer.
  - First-time Cloudflare Pages dashboard setup lives in `docs/cloudflare-pages-deployment.md`.
  - `pnpm -C apps/web preview` aliases `preview:cloudflare`, which runs `wrangler pages dev`
    against `build/client` for local production-style preview.
  - Deploy uses `pnpm -C apps/web deploy:cloudflare`.
- Embed relationship:
  - `apps/web` currently does not ship a maintained first-party embed demo route; embed remains an
    optional package-level adapter in `packages/embed`. A fuller host-facing example/rollout story
    is deferred in `DEBT-014`.
- Replay: controller is wired to solver playback controls.
- Store lifecycle: route-scoped stores inject ports and dispose worker/persistence resources on
  unmount for `/play` and `/bench`; `/lab` applies the same dispose discipline with direct
  `SolverPort` / `BenchmarkPort` refs.
- Solver recommendation/availability contract: `chooseAlgorithm` only recommends implemented ids; `/play` and `/bench` both consume the shared algorithm-label source, and when enabling new algorithms, keep solver `IMPLEMENTED_ALGORITHM_IDS` and both surfaces in sync.

## Non-responsibilities

- Game rules and mutation logic (belongs in `packages/core`)
- Solver algorithms and heuristics (belongs in `packages/solver`)
- Heavy compute loops (belongs in workers via `packages/worker`)

## Client-only boundaries (Remix)

Worker creation and browser-only APIs must be used in client-only contexts:

- `*.client.ts` modules only - the ESLint `WORKER_CREATION_RULE` flags `new Worker()` everywhere else
- `/play` solver wiring uses a Vite worker-url adapter:
  `solverWorker.client.ts?worker&url` -> `new Worker(workerUrl, { type: "module" })`
  with runtime bootstrap from `@corgiban/worker/runtime/solverWorker`
- Worker bootstrap modules may import `configureSolverKernelUrls.client.ts` before worker runtime
  bootstrap so optional solver-kernel URLs are applied in one client-only place. That bootstrap
  accepts only absolute URLs or app-root-relative paths and normalizes accepted values before
  publishing `globalThis.__corgibanSolverKernelUrls`.
- Dynamic imports and `useEffect()` are **not** approved escape hatches for worker construction
- Never import worker runtime code from Remix loaders/actions

## Hosting boundary

- Keep Cloudflare-specific code in:
  - `apps/web/functions/`
  - `apps/web/wrangler.jsonc`
  - `apps/web/scripts/preview-cloudflare.mjs`
- Keep shared server rendering in:
  - `apps/web/app/server/`
  - `apps/web/app/entry.server.tsx`
- Route modules and the root document should stay runtime-neutral and use
  `@remix-run/server-runtime` / `@remix-run/react` imports. When deployment-specific values are
  ever needed, thread them through Remix load context instead of importing host packages directly.

## Troubleshooting

- Vite dev must keep React runtime entrypoints deduped (`react`, `react-dom`,
  `react/jsx-runtime`, and `react/jsx-dev-runtime`) or hydration can fail with
  invalid-hook errors caused by split React dispatcher state.
- If dev shows hook errors such as `dispatcher is null`, `can't access property "useMemo", dispatcher is null`,
  or other hydration-only invalid-hook failures, fully restart the dev server.
- If the problem persists after restart, clear `apps/web/node_modules/.vite` and start `pnpm dev`
  again so Vite rebuilds its optimized dependency cache.

## Testing

- Component tests: React Testing Library
- Route behavior tests: keep deterministic, prefer unit-style tests
- Avoid snapshotting canvas pixels; test render plans where possible
- Main-thread recommendation profiling lives in
  `docs/verification/analyze-level-main-thread-profile.md`; use
  `pnpm profile:analyze-level:browser` against preview for `/play` and `/lab` traces

## Key dependencies

- React + TypeScript
- TailwindCSS
- Redux Toolkit
- Worker client from `packages/worker`
