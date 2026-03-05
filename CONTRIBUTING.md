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
node tools/scripts/profile-worker-validation.mjs  # optional: protocol validation profiling report
```

Dev server note: use `pnpm dev -- --clearScreen=false` (single argument). Passing `--clearScreen false` can be treated as a positional projectDir and result in "Remix Vite plugin not found in Vite config".

Validation profiling note: `node tools/scripts/profile-worker-validation.mjs` writes
`docs/_generated/analysis/phase-04-protocol-validation-profile.md`.

Optional runtime toggle: set `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1` when running `/play` to
exercise solver-client `light-progress` outbound validation for `SOLVE_PROGRESS` (default is strict).

## Creating a clean source zip

Use the source-only zip when sharing code for review:

```bash
pnpm zip:source
pnpm zip:source -- --ref HEAD
```

By default the zip is written to `artifacts/<repoName>-source-<shortSha>.zip`. The archive includes the current worktree (tracked files plus untracked files that are not ignored), while still excluding generated artifacts via `.gitignore`. To create a clean ref-only archive, use `pnpm zip:source -- --no-worktree`.

## Pre-commit hooks

Hooks install automatically on `pnpm install` via `simple-git-hooks` (the `prepare` script). They do not run in CI.

The pre-commit hook runs:

- `pnpm format:check`
- Deterministic affected unit tests via `node tools/scripts/run-affected-tests.mjs`
- Encoding policy check via `node tools/scripts/encoding-check.mjs` (UTF-8 without BOM, ASCII-only text except allow list)

Run `pnpm lint` and `pnpm typecheck` locally before opening a PR. CI enforces both.

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
- Add it to `IMPLEMENTED_ALGORITHM_IDS` when it is runnable end-to-end
- Update `chooseAlgorithm` rules if it should be selected automatically
- Add unit tests for correctness on fixture levels
- Ensure worker support and protocol selection are updated if the algorithm is worker-driven
- Keep progress + cancellation behavior consistent and deterministic

## Adding a new benchmark metric

- Add the metric to `packages/benchmarks` model/schema exports (single source of truth)
- Ensure worker solve/bench paths emit the metric deterministically
- Update `apps/web` persistence migration/tests when IndexedDB shape or indexes change
- Update benchmark report import/export shapes if the metric is serialized there
- Add or update tests and keep results comparable across runs

## Reporting issues

- Issues are disabled for now.

Security issues: see `SECURITY.md`.
