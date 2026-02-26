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

## Development workflow (once scaffolding exists)

Typical commands (once Phase 0 scaffold is complete):
```bash
pnpm typecheck       # tsc project references
pnpm lint            # ESLint (correctness + boundary checks)
pnpm test:coverage   # Vitest with enforced coverage thresholds
pnpm dev             # start Remix dev server
```

Pre-commit hooks run automatically: `pnpm lint` + unit tests for affected packages + encoding policy check (UTF-8 without BOM, ASCII-default text, no smart punctuation unless justified).

CI gates every PR on: typecheck, lint, tests+coverage, boundary checks, and encoding policy checks.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org): `type: short description`.

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`.

## Formatting and lint rules

- **Prettier** owns all formatting. Run `pnpm format` to auto-format (available once Phase 0 scaffold is complete).
- **ESLint** owns correctness and policy checks only. It does not enforce style.
- `eslint-config-prettier` disables any ESLint rules that overlap with Prettier.
- Do **not** add `@stylistic/eslint-plugin` or other ESLint formatting rules.
- Do **not** mix formatting changes with logic changes in a PR - keep them in separate commits.

## Adding a new solver algorithm (high level)

- Implement algorithm under `packages/solver/src/algorithms/`
- Register it in the solver registry
- Add unit tests for correctness on fixture levels
- Ensure worker supports selecting it through the protocol (if needed)
- Keep progress + cancellation behavior consistent

## Adding a new benchmark metric

- Add metric to the benchmark model (single source of truth)
- Ensure worker-runner emits it deterministically
- Add tests and update report rendering

## Reporting issues

- Issues are disabled for now.

Security issues: see `SECURITY.md`.
