This doc is an implementation spec for boundary tooling; it is written in agent-instruction style intentionally.

IMPORTANT:

- Boundary enforcement uses the standard TypeScript monorepo toolchain. Do not write custom
  AST-scanning boundary check scripts - ESLint and dependency-cruiser handle that.
- Custom scripts in tools/ are for reporting only (file size, time-usage summary).
- Keep changes scoped to: boundary-rules.mjs, ESLint config, dependency-cruiser config,
  package.json exports fields, and the tools/ report script. Do not modify game/solver/engine logic.
- Script language for tools/: TypeScript (.ts), executed via tsx. Strict TypeScript, lowerCamel.ts
  naming, 2-space indentation.
- Do NOT use SharedArrayBuffer or Atomics in any authored source in this repo - production,
  tests, and tools/ included. "Project-wide" means all files you write, not just production source.

====================================================================
A) Single-source boundary rules
====================================================================

Define ALL package boundary rules exactly once in a shared config file at repo root:

boundary-rules.mjs

Both ESLint and dependency-cruiser configs MUST import from this file. Rules are never duplicated
between the two tools. Adding a new package or rule means editing only boundary-rules.mjs.

boundary-rules.mjs defines and exports:

export const PACKAGES = ['shared', 'levels', 'formats', 'core', 'solver', 'worker', 'benchmarks', 'web'];
// When Phase 6/7 packages are introduced (`embed`, `solver-kernels`),
// extend PACKAGES and DIRECTION_RULES in the same change that adds those packages.

export const DIRECTION_RULES = [
// { from: <glob pattern>, disallow: [<glob pattern>, ...], forbidSpecifiers: [...] }
{ from: 'packages/shared/src/**', disallow: ['packages/core/**', 'packages/solver/**', 'packages/worker/**', 'packages/benchmarks/**', 'packages/levels/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', '@reduxjs/toolkit', 'react-router', 'react-router-dom'] },
{ from: 'packages/levels/src/**', disallow: ['packages/core/**', 'packages/solver/**', 'packages/worker/**', 'packages/benchmarks/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', '@reduxjs/toolkit'] },
{ from: 'packages/formats/src/**', disallow: ['packages/core/**', 'packages/solver/**', 'packages/worker/**', 'packages/benchmarks/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', '@reduxjs/toolkit'] },
{ from: 'packages/core/src/**', disallow: ['packages/solver/**', 'packages/worker/**', 'packages/benchmarks/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', '@reduxjs/toolkit', 'react-router', 'react-router-dom'] },
{ from: 'packages/solver/src/**', disallow: ['packages/worker/**', 'packages/benchmarks/**', 'packages/levels/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', '@reduxjs/toolkit', 'react-router', 'react-router-dom'] },
{ from: 'packages/worker/src/**', disallow: ['packages/levels/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', 'react-router', 'react-router-dom', '@reduxjs/toolkit'] },
{ from: 'packages/benchmarks/src/**', disallow: ['packages/levels/**', 'packages/worker/**', 'apps/**'], forbidSpecifiers: ['react', 'react-dom', 'react-router', 'react-router-dom'] },
];

// Boundary intent:
// - worker -> benchmarks is allowed (worker executes benchmark runs)
// - benchmarks -> worker is disallowed (one-way dependency to avoid cycles)

export const ADAPTER_PERSISTENCE_RULE = {
// Adapters must not import from the persistence folder (architectural path restriction).
// Library names (idb, dexie) are secondary; if the library changes, the path rule still holds.
adapterGlobs: ['apps/web/app/ui/**', 'apps/web/app/routes/**', 'apps/web/app/canvas/**'],
forbidPaths: ['apps/web/app/infra/persistence/**'],
forbidSpecifiers: ['idb', 'dexie'], // secondary; prefer path restriction as primary
};

export const WORKER_CREATION_RULE = {
// new Worker()/SharedWorker() is allowed only in explicit client modules.
allowedGlobs: ['apps/web/app/**/*.client.ts', 'packages/worker/src/client/**/*.client.ts'],
};

====================================================================
B) Standard toolchain setup
====================================================================

Boundary enforcement is specified in Project Plan section 2 and Architecture section 4.1.
Implement using the tools below. All derive from boundary-rules.mjs.
Assume `apps/web` runs Remix in Vite mode for resolver/bundling behavior.

1. package.json exports field - structural entrypoint enforcement (primary)
   Each workspace package exposes only its public entrypoint:
   { "exports": { ".": "./src/index.ts" } }
   Deep imports (e.g. packages/core/src/model/gameState) fail at the TypeScript compiler and
   app bundler resolver level before any lint rule fires.
   Note: This approach is correct for app-internal workspace usage. If any package is ever
   published to npm, switch its exports to point to compiled dist/ + declaration files.

2. TypeScript project references (tsc -b)
   Already specified in Project Plan. Each package tsconfig.json references only its allowed
   dependencies. Catches cross-package type violations at typecheck time.

3. ESLint with eslint-plugin-boundaries
   Configure in eslint.config.ts (ESLint v9 flat config).
   Import boundary-rules.mjs and map DIRECTION_RULES and ADAPTER_PERSISTENCE_RULE to
   eslint-plugin-boundaries element and rule definitions.
   Additionally configure:

   a) no-restricted-globals + no-restricted-syntax for banned APIs:
   SharedArrayBuffer and Atomics are banned in ALL authored source (production, tests, tools/).
   Apply this rule globally with no scope restriction. Both access forms must be caught: - no-restricted-globals: ['SharedArrayBuffer', 'Atomics'] - no-restricted-syntax targeting globalThis access:
   "MemberExpression[object.name='globalThis'][property.name='SharedArrayBuffer']"
   "MemberExpression[object.name='globalThis'][property.name='Atomics']"

   b) new Worker() placement (from WORKER_CREATION_RULE) - ESLint only, not dependency-cruiser:
   dependency-cruiser operates on module imports/requires, not runtime constructor calls.
   new Worker() is a runtime expression and cannot be reliably enforced by dependency-cruiser.
   Use no-restricted-syntax with a scoped ESLint override: - Apply globally: flag NewExpression[callee.name='Worker'] and
   NewExpression[callee.name='SharedWorker'] as errors. - Override only for `*.client.ts` paths declared in WORKER_CREATION_RULE.allowedGlobs.
   WORKER_CREATION_RULE.allowedGlobs informs the ESLint config override paths.
   In `apps/web`, import worker clients only from `.client.ts` modules so worker code never
   executes in Remix server contexts.

   c) Date/Date.now restriction for deterministic packages (packages/core/**, packages/solver/**):
   Both direct and globalThis forms must be caught: - no-restricted-globals (scoped override): ['Date'] - no-restricted-syntax:
   "MemberExpression[object.name='globalThis'][property.name='Date']"
   Allowlist: packages/shared/src/time.ts (use ESLint override to exclude this file).

   All of this runs as part of pnpm lint. No new CI scripts required.

4. dependency-cruiser
   Add dependency-cruiser.config.mjs at repo root (ESM so it can import boundary-rules.mjs).
   Map DIRECTION_RULES and ADAPTER_PERSISTENCE_RULE from boundary-rules.mjs to dependency-cruiser
   forbidden rules format. Do NOT map WORKER_CREATION_RULE - dependency-cruiser resolves module
   imports, not runtime constructor calls, so new Worker() placement cannot be enforced here.
   Add pnpm script: graph:deps
   pnpm exec depcruise --config dependency-cruiser.config.mjs packages/ apps/
   --output-type dot | dot -T svg > docs/\_generated/dep-graph.svg
   Run on-demand only (not in CI gate). Useful for architecture visualization.

====================================================================
C) Workspace setup for tools/ (report script only)
====================================================================

tools/ is a private pnpm workspace package containing only the best-practices report script.
No boundary-checking logic lives here.

Layout:

```
tools/
  src/
    bestPracticesReport.ts    (CLI entry point - thin)
    scanFiles.ts              (pure: file discovery via fast-glob)
    analyzeFiles.ts           (pure: size + time-usage analysis)
    reportFormatter.ts        (pure: markdown generation)
    __tests__/
      analyzeFiles.test.ts
      reportFormatter.test.ts
  package.json
  tsconfig.json
  vitest.config.ts
```

Create tools/package.json:

- name: @corgiban/tools
- private: true
- devDependencies: fast-glob

Create tools/tsconfig.json:

- Extend root tsconfig.base.json.
- Include src/\*_/_.ts. Target: Node (moduleResolution: bundler or node16). Strict on. No emit.
- Include tools/tsconfig.json in root tsc -b project references so pnpm typecheck covers it.

Create tools/vitest.config.ts:

- Include src/**tests**/\*_/_.test.ts.
- Aligned with root Vitest config (same coverage provider, reporter).
- Include tools tests in pnpm test and pnpm test:coverage via root Vitest workspace config.

Add tsx as a dev dependency at the repo root.

====================================================================
D) Add tools/src/scanFiles.ts, analyzeFiles.ts, reportFormatter.ts, bestPracticesReport.ts
====================================================================

Purpose:

- Informational report only. NOT a CI gate.
- Aggregates file-size and time-usage signals into a single markdown document.
- Boundary violations are enforced by pnpm lint (ESLint). This script does not duplicate that work.

Keep the CLI entry point (bestPracticesReport.ts) thin. Pure logic lives in separate modules
that are imported and tested directly - not through subprocess invocation.

scanFiles.ts (pure):
import glob from 'fast-glob';

export type ScanOptions = {
root: string;
include: string[]; // glob patterns relative to root
exclude: string[]; // normalized ignore patterns
};

export async function scanFiles(options: ScanOptions): Promise<string[]>
// Returns absolute paths. Uses fast-glob with the ignore patterns directly.
// Default include: ['packages/*/src/**/*.{ts,tsx,js,jsx,mjs}', 'apps/web/app/**/*.{ts,tsx,js,jsx,mjs}']
// Default exclude: ['**/node_modules/**', '**/dist/**', '**/dist-types/**', '**/build/**',
// '**/coverage/**', '**/docs/_generated/**']

analyzeFiles.ts (pure):
export type SizeStatus = 'P' | 'W' | 'F'; // P<=500, W=501-800, F>800

export type FileRecord = {
path: string; // repo-root-relative, POSIX
lines: number;
sizeStatus: SizeStatus;
hasTimeUsage: boolean; // true if file is in core/solver scope and contains Date/Date.now
};

export function analyzeFile(absolutePath: string, root: string): FileRecord
// Reads file, counts lines, checks sizeStatus, checks time usage if in core/solver scope.
// Time-usage check: packages/core/src/** and packages/solver/src/** only.
// Allowlist: packages/shared/src/time.ts (never flagged).
// Sync function; files are small enough that sync I/O is acceptable here.

export function analyzeAll(paths: string[], root: string): FileRecord[]
// Maps analyzeFile over all paths. Returns sorted by path (POSIX).

reportFormatter.ts (pure):
export function formatReport(records: FileRecord[], generatedAt: Date): string
// Returns the full markdown string for best_practices_report.md.
// Sections:
// - Header: "Generated: <ISO timestamp>"
// - File size summary: count + list of W files (501-800), count + list of F files (>800)
// - Time-usage summary (informational): list of core/solver files where hasTimeUsage=true
// labeled as informational; enforcement is via ESLint

bestPracticesReport.ts (CLI entry, thin):

- Parses --out-dir from argv (default: docs/\_generated/analysis).
- Calls scanFiles, analyzeAll, formatReport.
- Writes output file. Exits 0 on success, 1 on filesystem error.
- No --check mode. Informational only.

Generates: <out-dir>/best_practices_report.md

====================================================================
E) Wire into package scripts
====================================================================

Add pnpm scripts at repo root (package.json):

- graph:deps: pnpm exec depcruise --config dependency-cruiser.config.mjs packages/ apps/ --output-type dot | dot -T svg > docs/\_generated/dep-graph.svg
- best-practices: tsx tools/src/bestPracticesReport.ts --out-dir docs/\_generated/analysis

CI gate (GitHub Actions, every PR):

- pnpm format:check
- pnpm typecheck (project references + exports field catches deep imports)
- pnpm lint (eslint-plugin-boundaries, no-restricted-globals, no-restricted-syntax)
- pnpm test:coverage
- encoding policy check (UTF-8 without BOM, ASCII-only text except allow list, no smart punctuation unless allowlisted)
  graph:deps and best-practices run on-demand only.

Create docs/\_generated/analysis/README.md:

- These files are generated - do not edit manually.
- Regenerate with: pnpm best-practices
- Boundary violations are caught by pnpm lint, not this report.
- Do not commit generated files to source control (add to .gitignore).

====================================================================
F) Tests
====================================================================

Test pure functions directly (not primarily via subprocess). Tests live in tools/src/**tests**/.

analyzeFiles.test.ts:

- analyzeFile with a file <= 500 lines -> sizeStatus: 'P'
- analyzeFile with a file 501-800 lines -> sizeStatus: 'W'
- analyzeFile with a file > 800 lines -> sizeStatus: 'F'
- analyzeFile on a packages/core/src/ file containing Date.now( -> hasTimeUsage: true
- analyzeFile on a packages/core/src/ file without any Date reference -> hasTimeUsage: false
- analyzeFile on packages/shared/src/time.ts containing Date.now( -> hasTimeUsage: false (allowlist)
- analyzeFile on apps/web/app/ file containing Date.now( -> hasTimeUsage: false (not in scope)
- analyzeAll returns records sorted by path

reportFormatter.test.ts:

- formatReport with no records -> valid markdown, no W/F entries
- formatReport with a mix of P/W/F records -> W and F files appear in correct sections
- formatReport with a record where hasTimeUsage=true -> appears in time-usage summary
- Generated: timestamp line is present and uses ISO format

A minimal subprocess smoke test for bestPracticesReport.ts is acceptable but not the primary
test strategy. Prefer testing analyzeFiles and reportFormatter directly.

====================================================================
G) Stop conditions / deliverables
====================================================================

At the end, print:

- Files added or modified (including boundary-rules.mjs, eslint.config.ts, dependency-cruiser.config.mjs)
- pnpm scripts added
- Confirm:
  - pnpm lint catches boundary direction violations (eslint-plugin-boundaries active)
  - pnpm lint catches SharedArrayBuffer including globalThis.SharedArrayBuffer form
  - pnpm lint catches Date usage in packages/core and packages/solver, not in apps/web app-layer code
  - pnpm typecheck catches deep package imports (package.json exports field active)
  - pnpm best-practices generates report without errors
  - pnpm test:coverage passes including tools/ tests
