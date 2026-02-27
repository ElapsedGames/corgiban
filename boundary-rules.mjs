// boundary-rules.mjs -- single source of truth for all package boundary rules.
//
// Both eslint.config.ts and dependency-cruiser.config.mjs import from this file.
// Rules are never duplicated between the two tools. If you add a new package or
// change an allowed dependency direction, edit only this file.
//
// Dependency direction (most isolated -> most dependent):
//   shared     ->  (nothing)
//   levels     ->  shared
//   core       ->  shared, levels
//   solver     ->  shared, core
//   benchmarks ->  shared, core, solver
//   worker     ->  shared, core, solver, benchmarks
//   apps/web   ->  all packages (via public entrypoints only)
//
// Note: worker -> benchmarks is intentionally allowed (the worker executes
// benchmark runs). benchmarks -> worker is disallowed to prevent a cycle.
//
// To add a new package:
//   1. Add its name to PACKAGES.
//   2. Add an entry to DIRECTION_RULES with `from` (its source glob),
//      `disallow` (everything it must not import), and any `forbidSpecifiers`.
//   3. Update tsconfig.json project references for the new package.
//   4. Update docs/Architecture.md section 4.1.

export const PACKAGES = ['shared', 'levels', 'core', 'solver', 'worker', 'benchmarks', 'web'];

export const DIRECTION_RULES = [
  {
    from: 'packages/shared/src/**',
    disallow: [
      'packages/core/**',
      'packages/solver/**',
      'packages/worker/**',
      'packages/benchmarks/**',
      'packages/levels/**',
      'apps/**',
    ],
    forbidSpecifiers: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-router',
      'react-router-dom',
    ],
  },
  {
    from: 'packages/levels/src/**',
    disallow: [
      'packages/core/**',
      'packages/solver/**',
      'packages/worker/**',
      'packages/benchmarks/**',
      'apps/**',
    ],
    forbidSpecifiers: ['react', 'react-dom', '@reduxjs/toolkit'],
  },
  {
    from: 'packages/core/src/**',
    disallow: ['packages/solver/**', 'packages/worker/**', 'packages/benchmarks/**', 'apps/**'],
    forbidSpecifiers: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-router',
      'react-router-dom',
    ],
  },
  {
    from: 'packages/solver/src/**',
    disallow: ['packages/worker/**', 'packages/benchmarks/**', 'packages/levels/**', 'apps/**'],
    forbidSpecifiers: [
      'react',
      'react-dom',
      '@reduxjs/toolkit',
      'react-router',
      'react-router-dom',
    ],
  },
  {
    from: 'packages/worker/src/**',
    disallow: ['packages/levels/**', 'apps/**'],
    forbidSpecifiers: [
      'react',
      'react-dom',
      'react-router',
      'react-router-dom',
      '@reduxjs/toolkit',
    ],
  },
  {
    from: 'packages/benchmarks/src/**',
    disallow: ['packages/levels/**', 'packages/worker/**', 'apps/**'],
    forbidSpecifiers: ['react', 'react-dom', 'react-router', 'react-router-dom'],
  },
];

// ADAPTER_PERSISTENCE_RULE prevents UI/route/canvas code from importing the
// persistence layer directly. Adapters must call workflows (RTK thunks); workflows
// call ports; ports use persistence adapters. Bypassing this creates tight coupling
// between UI and storage that makes testing and future storage changes painful.
export const ADAPTER_PERSISTENCE_RULE = {
  adapterGlobs: ['apps/web/app/ui/**', 'apps/web/app/routes/**', 'apps/web/app/canvas/**'],
  forbidPaths: ['apps/web/app/infra/persistence/**'],
  forbidSpecifiers: ['idb', 'dexie'],
};

// WORKER_CREATION_RULE restricts where `new Worker()` may appear. Workers must
// only be created in *.client.ts modules so Remix never tries to instantiate them
// during server-side rendering. Worker construction pattern (from LLM_GUIDE.md):
//   new Worker(new URL('./solverWorker.ts', import.meta.url), { type: 'module' })
export const WORKER_CREATION_RULE = {
  allowedGlobs: ['apps/web/app/**/*.client.ts', 'packages/worker/src/client/**/*.client.ts'],
};
