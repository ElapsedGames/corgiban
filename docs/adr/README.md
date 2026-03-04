# Architecture Decision Records (ADRs)

ADRs are short documents capturing a decision, its context, and consequences.
They are used for decisions that are costly to reverse or that affect multiple subsystems.

## When to write an ADR

Write an ADR when you introduce or change any of these:

- Package boundaries or dependency direction
- Worker protocol versions or message semantics
- Persistence schema changes (IndexedDB stores, migrations)
- Routing and app-shell decisions (Remix patterns, client-only boundaries)
- Solver state model, hashing scheme, or algorithm contracts
- New optional subsystems (embed, lab, kernels/WASM) or feature-flag strategy

If in doubt, write one. Keep it short.

## Format and naming

- File name: `NNNN-kebab-case-title.md` (example: `0003-worker-protocol-v2.md`)
- One decision per ADR
- Use `docs/adr/0000-template.md` as the starting point

## Status values

Use one of:

- **Proposed**
- **Accepted**
- **Superseded**
- **Deprecated**

If an ADR is superseded, link bidirectionally:

- The old ADR status line should read: `Superseded by [NNNN-title](NNNN-title.md)`
- The new ADR should link back: `Supersedes [MMMM-title](MMMM-title.md)`

## Guidance

- Focus on: context -> decision -> consequences
- Keep alternatives brief, but list the important ones considered
- Prefer "how this constrains future work" over lengthy narrative

## Current ADRs

- `0001-remix-first-app-shell-vite-mode.md`
- `0002-monorepo-boundary-enforcement-strategy.md`
- `0003-worker-protocol-versioning-validation.md`
- `0004-push-based-solver-model.md`
- `0005-canvas-renderplan-split.md`
- `0006-embed-shadow-dom-styling-delivery.md`
- `0007-indexeddb-persistence-migration-retention.md`
- `0008-tsconfig-project-references-emission-policy.md`
- `0009-solver-optimized-state-representation-hashing.md`
- `0010-level-format-interop-policy.md`
- `0011-solver-protocol-solution-contract.md`
- `0012-replay-pipeline-shadow-state.md`
- `0013-solver-cancellation-worker-reset.md`
