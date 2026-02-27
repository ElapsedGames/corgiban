# ADR 0008: TypeScript project references and emission policy

**Status:** Accepted
**Date:** 2026-02-27
**Deciders:** Corgiban maintainers

## Context

This repo uses TypeScript project references (`tsc -b`) to enforce that each package only
imports from its allowed upstream packages, and to enable incremental cross-package type
checking. Project references are declared in each package's `tsconfig.json` via the
`"references"` field and in the root `tsconfig.json` which lists all packages.

TypeScript has a hard requirement: every project in a `tsc -b` reference graph must be
capable of emitting output. If a package sets `"noEmit": true`, TypeScript raises TS6310
("referenced project may not disable emit") and the entire build fails.

At the same time, packages in this repo are consumed as TypeScript source at runtime.
Vite reads the original `.ts` files directly via the `"exports"` field in each
`package.json` (which points to `./src/index.ts`). There is no prebuild step -- packages
do not need to emit `.js` files for the app to work. In fact, emitting `.js` files next
to source would create confusion about which file Vite is actually reading.

These two requirements conflict:

- `tsc -b` **requires** emit to be enabled on all referenced projects.
- Runtime **requires** no `.js` output (Vite reads `.ts` source directly).

## Decision

Set `"emitDeclarationOnly": true` (together with `"declaration": true` and
`"declarationMap": true`) in `tsconfig.base.json`, which every package tsconfig extends.

- Only `.d.ts` type declaration files are written -- no `.js` files are emitted.
- Each package tsconfig adds `"outDir": "dist-types"` to keep declaration files out of
  the source tree.
- `dist-types/` is listed in `.gitignore`. These files are never committed.
- Vite ignores `dist-types/` entirely and continues to read `.ts` source via exports map.
- `tsc -b` is satisfied: it reads the `.d.ts` files to verify types across package
  boundaries and to drive incremental rebuilds.

`"noEmit"` is intentionally absent from `tsconfig.base.json`. The Remix app (`apps/web`)
also cannot use `"noEmit": true` because it participates in the root `tsconfig.json`
project reference graph. It uses `"outDir": "dist-types"` like the packages do.

## Consequences

**Positive:**

- `pnpm typecheck` (`tsc -b`) works and catches cross-package type errors.
- No `.js` files are emitted alongside source. Vite always reads the original `.ts`.
- The policy is encoded once in `tsconfig.base.json` and inherited automatically.
- `declarationMap: true` means IDE "go to definition" navigates to `.ts` source, not
  `.d.ts` stubs.

**Negative:**

- `dist-types/` directories appear in every package and in `apps/web` after `tsc -b`
  runs. They are gitignored but may appear in IDE file explorers.
- `"noEmit"` being absent from the base config is non-obvious. Developers accustomed
  to `"noEmit": true` for type-checking-only setups may try to add it and break the
  build. This ADR and the comments in `tsconfig.base.json` serve as the explanation.
- If a package is ever published to npm as a pre-built artifact, the policy will need
  revisiting to also emit `.js` files alongside the `.d.ts` declarations.

## Alternatives considered

**Keep `"noEmit": true` in base; typecheck each package with `tsc --noEmit` separately**
Each package could run `tsc --noEmit` independently. This avoids the emission requirement
but loses the incremental cross-package build and the guarantee that all packages are
type-checked together in dependency order. Rejected because `tsc -b` is the right model
for a monorepo with explicit dependency direction.

**Remove `apps/web` from root `tsconfig.json` references; typecheck it separately**
The app could be excluded from `tsc -b` and typechecked with a standalone
`tsc -p apps/web/tsconfig.json --noEmit` step. This would allow `"noEmit": true` on the
app. Rejected as unnecessary added complexity -- the app emitting `.d.ts` to
`dist-types/` is harmless and keeping everything in one `tsc -b` invocation is simpler.

**Use path aliases instead of project references**
TypeScript `"paths"` aliases can resolve workspace package imports without project
references, allowing `"noEmit": true` everywhere. Rejected because project references
provide incremental build, correct dependency ordering, and the `"composite"` isolation
check that prevents accidental cross-boundary imports at the compiler level.

## Testing plan

- `pnpm typecheck` must exit 0 after any change to a package's public API.
- A cross-package type error (e.g. importing a non-exported symbol from a package) must
  cause `tsc -b` to fail with a clear error pointing to the offending import.
- `dist-types/` contents must not appear in `git status` (enforced by `.gitignore`).

## Links

- `tsconfig.base.json` -- base config where this policy is set
- `docs/Architecture.md` section 3.1 -- monorepo structure decision
- `docs/adr/0002-monorepo-boundary-enforcement-strategy.md` -- boundary enforcement context
