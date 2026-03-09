# Architecture Decision Records (ADRs)

ADRs are short documents capturing a decision, its context, and consequences.
They are used for decisions that are costly to reverse or that affect multiple subsystems.

## When to write an ADR

Write an ADR when you introduce or change any of these:

- Package boundaries or dependency direction
- Worker protocol versions or message semantics
- Persistence schema changes (IndexedDB stores, migrations)
- Versioned benchmark/export artifact contracts (reports, comparison snapshots)
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

## Reviewer pointers

- ADR-0013 (`0013-solver-cancellation-worker-reset.md`) is the source of truth for `/play`
  hard-reset cancellation semantics. The absence of `SOLVE_CANCEL` in protocol v2 is intentional.
- Benchmark cancellation is a separate contract in ADR-0014
  (`0014-benchmark-worker-cancellation-semantics.md`); do not assume `/play` and `/bench` use the
  same cancellation path.
- ADR-0025 (`0025-route-store-ssr-safe-port-bootstrap.md`) is the source of truth for `/play` and
  `/bench` route-store bootstrap. Browser-backed ports attach after commit; they are not created
  during route render.
- ADR-0026 (`0026-app-shell-theme-ownership.md`) is the source of truth for the shared root
  navigation + theme toggle contract. Theme bootstrap is resolved in the app shell before paint;
  route-scoped Redux stores do not own theme.
- Not every review-sensitive contract has a standalone ADR. The explicit monotonic-clock failure
  path is documented in `LLM_GUIDE.md`, `docs/Architecture.md`, `packages/solver/README.md`, and
  `docs/review-notes.md`.

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
- `0014-benchmark-worker-cancellation-semantics.md`
- `0015-worker-progress-light-validation-mode.md`
- `0016-benchmark-report-contract-versioning.md`
- `0017-pwa-offline-workbox-strategy.md`
- `0018-solver-client-ping-liveness-timeout.md`
- `0019-benchmark-persistence-sticky-memory-fallback.md`
- `0020-benchmark-comparison-snapshot-contract.md`
- `0021-solver-kernel-delivery-preload-contract.md`
- `0022-solver-progress-throttle-ownership.md`
- `0023-lab-route-local-state-ownership.md`
- `0024-offscreen-sprite-atlas-worker-fallback.md`
- `0025-route-store-ssr-safe-port-bootstrap.md`
- `0026-app-shell-theme-ownership.md`
