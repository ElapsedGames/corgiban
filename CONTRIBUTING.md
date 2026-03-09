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
pnpm test:smoke      # Playwright smoke tests (routes incl. /lab, /play, /bench persistence, offline shell)
pnpm dev             # start Remix dev server
pnpm build           # build Remix app
pnpm -C apps/web preview          # Cloudflare Pages-style production preview for apps/web
pnpm -C apps/web deploy:cloudflare # deploy apps/web through the current Cloudflare Pages adapter
pnpm issue:new --type bug --severity medium --area ui --title "Describe the problem"
pnpm issue:close --id BUG-001 --fixed-by "Your Name" --resolution "Short closure note"
pnpm issue:generate  # regenerate KNOWN_ISSUES.md after issue edits
pnpm issue:check     # verify KNOWN_ISSUES.md is in sync
pnpm graph:deps      # optional dependency graph -> docs/_generated/dep-graph.svg
pnpm best-practices  # optional placeholder CLI; report artifact wiring is still tracked in DEBT-007
node tools/scripts/profile-worker-validation.mjs  # optional: protocol validation profiling report
```

Playwright note: install browsers once with `pnpm exec playwright install chromium` before running
`pnpm test:smoke` locally.
`pnpm test:smoke` builds the Remix app and runs Playwright against a production preview server
without reusing an existing local server process. That production preview path now goes through the
Cloudflare Pages adapter (`pnpm -C apps/web preview:cloudflare`, which wraps `wrangler pages dev`).
If port `43173` is already in use, set `PLAYWRIGHT_PORT` (for example
`PLAYWRIGHT_PORT=4273 pnpm test:smoke` on POSIX shells or
`$env:PLAYWRIGHT_PORT='4273'; pnpm test:smoke` in PowerShell).

Dev server note: use `pnpm dev -- --clearScreen=false` (single argument). Passing `--clearScreen false` can be treated as a positional projectDir and result in "Remix Vite plugin not found in Vite config".

Validation profiling note: `node tools/scripts/profile-worker-validation.mjs` writes
`docs/_generated/analysis/phase-04-protocol-validation-profile.md`.
Optional architecture tooling:

- `pnpm graph:deps` refreshes `docs/_generated/dep-graph.svg`.
- `pnpm best-practices` currently exercises the CLI arg plumbing and reports that artifact
  generation is still unavailable; wiring the final report output remains tracked in `DEBT-007`.

Optional runtime toggle: set `VITE_WORKER_LIGHT_PROGRESS_VALIDATION=1` when running `/play` to
exercise solver-client `light-progress` outbound validation for `SOLVE_PROGRESS` (default is strict).
For manual PWA/offline checks outside Playwright, run dev with `VITE_ENABLE_PWA_DEV=1`.
Optional solver-kernel preload wiring: set any of
`VITE_SOLVER_KERNEL_REACHABILITY_URL`, `VITE_SOLVER_KERNEL_HASHING_URL`, or
`VITE_SOLVER_KERNEL_ASSIGNMENT_URL` to point worker bootstraps at optional WASM kernels. Use
absolute URLs or app-root-relative paths only; the client bootstrap normalizes accepted values to
absolute URLs before worker startup. Failed kernel loads fall back to the TS baseline path and do
not block solve/bench execution.
Top-level offline reload proof steps are documented in `docs/verification/offline-top-level-proof.md`.

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

CI gates every PR on: format:check, typecheck, lint, tests+coverage, `pnpm test:smoke`,
boundary checks, encoding policy checks, and `pnpm issue:check` for tracker dashboard sync.

## Local issue tracker

GitHub issues are disabled, so repo work is tracked locally:

- `.tracker/issues/*.md` is the source of truth for open, deferred, and fixed work items.
- `KNOWN_ISSUES.md` is generated from those issue files; do not hand-edit it.
- File a new tracked item with `pnpm issue:new`.
- Close a tracked item with `pnpm issue:close`, then regenerate the dashboard with `pnpm issue:generate`.
- If a PR defers a non-trivial bug or cleanup, track it in `.tracker/issues/*.md` instead of leaving it only in TODOs or PR notes.

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
