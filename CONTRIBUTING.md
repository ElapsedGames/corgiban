# Contributing

Thanks for checking out Corgiban. This repo is intentionally structured to keep architecture boundaries clear and changes reviewable.

## Contribution status

- This repository is public for visibility and planning transparency.
- Not accepting PRs yet.
- Issues are disabled for now.
- Security reports are still accepted through the process in `SECURITY.md`.

## Ground rules

- Keep changes **scoped** and **reviewable**
- Prefer **additive changes + migration** over large rewrites
- Enforce boundaries (see `docs/Architecture.md` and `docs/dev-tools-spec.md`)
- Add tests for non-trivial logic and for most bug fixes

## Where to start

- `docs/START_HERE.md`
- `docs/Architecture.md`
- `docs/project-plan.md`
- `LLM_GUIDE.md` (canonical repo rules)

## Development workflow

Typical commands:

```bash
pnpm typecheck       # tsc project references
pnpm lint            # ESLint (correctness + boundary checks)
pnpm format          # Prettier (auto-format)
pnpm format:check    # Prettier (check formatting)
pnpm test            # Vitest workspace (unit tests)
pnpm test:coverage   # Vitest with enforced coverage thresholds
pnpm dev             # start Remix dev server
pnpm build           # build Remix app
```

Dev server note: use `pnpm dev -- --clearScreen=false` (single argument). Passing `--clearScreen false` can be treated as a positional projectDir and result in "Remix Vite plugin not found in Vite config".

## Pre-commit hooks

Hooks install automatically on `pnpm install` via `simple-git-hooks` (the `prepare` script). They do not run in CI.

The pre-commit hook runs:

- `pnpm format:check`
- `pnpm lint`
- Deterministic affected unit tests via `node tools/scripts/run-affected-tests.mjs`
- Encoding policy check via `node tools/scripts/encoding-check.mjs` (UTF-8 without BOM, ASCII-only text)

Affected test selection strategy (deterministic):

- Uses staged files from `git diff --cached`
- Runs `pnpm test` if any staged file is under `apps/`, `packages/`, or `tools/`, or is a root config file with a code extension
- Skips tests when only docs or markdown files are staged

CI gates every PR on: format:check, typecheck, lint, tests+coverage, boundary checks, and encoding policy checks.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org): `type: short description`.

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`.

## Formatting and lint rules

- **Prettier** owns all formatting. Use your editor integration or `pnpm format` / `pnpm format:check`.
- **ESLint** owns correctness and policy checks only. It does not enforce style.
- `eslint-config-prettier` disables any ESLint rules that overlap with Prettier.
- Do **not** add `@stylistic/eslint-plugin` or other ESLint formatting rules.
- Do **not** mix formatting changes with logic changes in a PR - keep them in separate commits.

## Adding a new solver algorithm (high level)

- Implement the algorithm under `packages/solver/src/algorithms/`
- Register it in the solver registry (and export from the solver public API)
- Update `chooseAlgorithm` rules if it should be selected automatically
- Add unit tests for correctness on fixture levels
- Ensure worker support and protocol selection are updated if the algorithm is worker-driven
- Keep progress + cancellation behavior consistent and deterministic

## Adding a new benchmark metric

- Add the metric to the benchmark model (single source of truth)
- Ensure the worker runner emits it deterministically
- Update any persistence schema or report formatting that depends on it
- Add or update tests and keep results comparable across runs

## Reporting issues

- Issues are disabled for now.

Security issues: see `SECURITY.md`.
