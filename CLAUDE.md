# CLAUDE.md -- Claude entrypoint (Corgiban)

Read `LLM_GUIDE.md` for the full project guidance. This file repeats only the non-negotiables.
If anything conflicts, `LLM_GUIDE.md` wins.
Pre-commit hook details live in `LLM_GUIDE.md`.

If a rule must be broken, document it briefly in the PR description and/or an ADR.

## Non-negotiables

- Read-first routing: `docs/Architecture.md`, `docs/adr/*`, and relevant package README(s).
- Boundary rules: core -> shared/levels only; solver -> core/shared only; worker -> solver/core/shared/benchmarks only; apps/web via public entrypoints.
- Main thread stays responsive; heavy compute runs in workers.
- Core/solver deterministic and pure; no DOM/Web APIs in solver.
- Worker protocol is versioned and validated; no ad-hoc JSON shapes.
- Keep changes scoped; avoid sweeping refactors or mixed formatting + logic.
- Tests required for non-trivial logic; maintain coverage gates; run full unit suite + typecheck + lint before commit.
