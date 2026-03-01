import { defineWorkspace } from 'vitest/config';

// Lists every vitest config that `pnpm test` and `pnpm test:coverage` will run.
//
// Why only tools/ was here in Phase 0:
//   packages/* contained only stub index.ts files -- no tests existed yet.
//   apps/web has its own vitest.config.ts, but it is kept out of this workspace
//   config intentionally. The key rule: never add vite.config.ts to this list,
//   because that would load the Remix Vite plugin and break the test runner.
//   apps/web/vitest.config.ts deliberately does NOT import the Remix plugin,
//   which is what makes it safe to include here when the time comes.
//
// When to add entries:
//   Add a package config here when that package has real tests.
//   Add apps/web/vitest.config.ts here when the first app-level test is written.
export default defineWorkspace([
  'tools/vitest.config.ts',
  'packages/levels/vitest.config.ts',
  'packages/core/vitest.config.ts',
]);
