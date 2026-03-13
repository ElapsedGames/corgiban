## Phase 0 Integration Notes

### 1) Workspace TS-source imports work in Remix Vite dev and build

Evidence:

- Workspace import exists in `apps/web/app/routes/_index.tsx` via `@corgiban/shared` public entrypoint.
- Commands run:
  - `pnpm dev -- --clearScreen=false`
  - `pnpm build`
- Expected behavior:
  - Dev server starts and stays running without import resolution errors.
  - Build succeeds and produces client + SSR bundles.
- Observed:
  - `pnpm dev -- --clearScreen=false` ran and remained active until terminated by timeout; no errors were printed before termination.
  - `pnpm build` succeeded and produced both client and SSR bundles.
- Documentation location: this file (`docs/phase-00-integration.md`).

### 2) SSR bundling is correct; ssr.noExternal requirement

Evidence:

- Command run: `pnpm build`
- Expected behavior:
  - SSR bundle succeeds without requiring extra `ssr.noExternal`.
- Observed:
  - Build completed successfully with SSR bundle output.
  - No `ssr.noExternal` override is configured in `apps/web/vite.config.ts`, and none was required.
- Why `ssr.noExternal` is unnecessary:
  - pnpm exposes workspace packages as TS source via the `exports` map pointing to `./src/index.ts`,
    so Vite processes them through its bundler pipeline instead of treating them as pre-built externals.
- Config keys:
  - `ssr.noExternal` not set (unnecessary with current workspace setup).
- Documentation location: this file (`docs/phase-00-integration.md`).

### 3) Vite dev server workspace FS access; server.fs.allow requirement

Evidence:

- Command run: `pnpm dev -- --clearScreen=false`
- Expected behavior:
  - No "forbidden fs access" errors while importing workspace packages.
- Observed:
  - No forbidden FS access errors were emitted during dev startup (command remained running).
  - `server.fs.allow` not configured in `apps/web/vite.config.ts`.
- Why `server.fs.allow` is unnecessary:
  - pnpm places workspace package symlinks in the root `node_modules`, which Vite can already access
    from the repo root without an explicit allowlist.
- Config keys:
  - `server.fs.allow` not set (unnecessary with current workspace layout).
- Documentation location: this file (`docs/phase-00-integration.md`).

### 4) Vitest runs without loading the Remix plugin

Evidence:

- Commands run:
  - `pnpm test`
  - `pnpm test:coverage`
- Expected behavior:
  - Tests run without Remix/Vite plugin wiring.
- Observed:
  - Tests ran via `vitest.workspace.ts`, which aggregates the package and app `vitest.config.ts`
    files rather than loading any `vite.config.ts`.
  - `apps/web/vitest.config.ts` remains separate from `apps/web/vite.config.ts` and does not
    import the Remix plugin.
- Config keys:
  - Separate Vitest config (`vitest.workspace.ts`) to avoid Remix plugin coupling.
- Documentation location: this file (`docs/phase-00-integration.md`).

### Notes

- Remix Vite dev flag parsing: prefer `--clearScreen=false` (single argument). Passing `--clearScreen false` can be treated as a positional projectDir and lead to "Remix Vite plugin not found in Vite config".
- Build warnings observed:
  - Vite CJS Node API deprecation warning.
  - React Router v7 future-flag warnings during `pnpm build`.

Tools best-practices report status:

- `pnpm best-practices` now scans the documented source globs, analyzes file size and
  time-usage signals, formats the markdown report, and writes
  `docs/_generated/analysis/best_practices_report.md`.
- See `docs/dev-tools-spec.md` for the full spec and the tests in `tools/src/__tests__/` for
  the current implementation contract.

---

## Design Notes

These notes explain the architectural reasoning behind Phase 0 decisions for anyone
coming to this codebase fresh. They answer "why is it set up this way?" rather than
just "what does it do?".

### Why pnpm workspaces?

A pnpm workspace monorepo puts all packages in one repo with shared tooling, but keeps
each package isolated -- it can only import what it declares as a dependency. This lets
the solver, game engine, and worker runtime evolve independently without accidentally
coupling to the UI layer. pnpm's strict dependency isolation (no phantom dependencies)
is stronger than npm or yarn workspaces: if a package is not listed as a dependency of
`apps/web`, importing it will fail at build time even if it happens to be installed
somewhere on disk.

### Why TypeScript project references (`tsc -b`)?

TypeScript project references let the compiler understand the dependency graph between
packages and type-check them in the correct order. When you change `packages/shared`,
`tsc -b` knows that `packages/core` (which depends on `shared`) needs to be rechecked.
Without project references you would need to typecheck every package independently and
hope you did them in the right order.

The tradeoff: `tsc -b` requires every referenced package to emit output (`.d.ts` files).
See `docs/adr/0008-tsconfig-project-references-emission-policy.md` for the full
explanation of why `emitDeclarationOnly` is used here instead of `noEmit`.

### Why `boundary-rules.mjs` as the single source?

ESLint and dependency-cruiser both enforce package boundaries, but they approach it from
different angles. ESLint catches violations as you write code (in the editor and in the
CI lint step). dependency-cruiser can generate a visual graph of the actual import
structure and validate it on demand.

If the boundary rules were duplicated in both tool configs they would inevitably drift.
`boundary-rules.mjs` is the single file to edit when adding a package or changing what
is allowed to depend on what. Both tools import from it so they always agree.

### Why a separate `vitest.workspace.ts` instead of running Vite's config?

Remix's Vite plugin does a lot of work: it starts an SSR server, sets up Remix-specific
module transformations, and wires the router. None of that should be triggered inside a
Vitest test run. If Vitest loaded `apps/web/vite.config.ts` it would attempt to start
the Remix dev infrastructure and likely fail or produce confusing output.

The solution is two configs that exist side by side:

- `apps/web/vite.config.ts` -- used by `remix vite:dev` and `remix vite:build`. Has the
  Remix plugin. Never imported by Vitest.
- `apps/web/vitest.config.ts` -- used by Vitest. No Remix plugin. Independent.
- `vitest.workspace.ts` at the repo root references the Vitest configs, not Vite configs.

### Why `server.fs.allow` was not needed

Vite restricts which files on disk it will serve, defaulting to files inside the project
`root` (the `apps/web` folder). Workspace packages live outside that root, so accessing
them could trigger a "403 Forbidden" access error.

In this setup it works without configuration because pnpm creates symlinks for all
workspace packages inside the root `node_modules`. When Vite resolves
`@corgiban/shared`, it follows the symlink at `node_modules/@corgiban/shared` back into
`packages/shared/src`. Since the symlink is accessed via `node_modules` (which Vite
always allows), no allowlist entry is needed.

### Why `ssr.noExternal` was not needed

In Remix SSR builds, Vite by default externalises (does not bundle) packages it finds in
`node_modules`, expecting them to be pre-built CJS or ESM modules. Workspace packages
that point to `.ts` source files would normally fail this check because Node cannot run
TypeScript directly.

It works here because each package's `"exports"` field points to `./src/index.ts`. When
Vite encounters this during SSR bundling it sees the `.ts` extension, processes the file
through its own bundler pipeline, and includes it in the SSR bundle rather than treating
it as an external. No `ssr.noExternal` override is required as long as the exports map
uses `.ts` source paths directly.
