# ADR 0006: Web Component embed strategy (Shadow DOM and styling delivery)

**Status:** Accepted
**Date:** 2026-02-26
**Deciders:** Corgiban maintainers

## Context

The project includes an optional embed adapter for third-party hosts with unknown CSS and runtime
conditions. The embed must be isolated and stable without coupling the main app bundle to embed-
specific requirements.

## Decision

- `packages/embed` is an optional adapter for third-party embedding.
- The embed uses Shadow DOM by default.
- Styles are delivered via scoped stylesheet injection into the shadow root.
- The embed bundles React as a dependency (not a peer dependency) for self-contained runtime use.
- `apps/web` does not depend on `packages/embed` on its core bundle path.

## Consequences

- Positive: Strong CSS isolation from host-page styles.
- Positive: Works in non-React host pages without host version coupling.
- Negative: Embed package includes its own React runtime cost.
- Negative: Custom-element lifecycle and stylesheet handling require dedicated integration tests.

## Alternatives considered

- Light DOM embed with host CSS integration only.
- Shadow DOM with host-provided stylesheet contract.
- Peer dependency on host React versions.

## Rollout plan (if applicable)

- Phase 6 introduces `packages/embed` as an optional package.
- Lifecycle and event contracts are validated with integration tests in the same phase.

## Testing plan

- Integration tests for custom element mount/unmount lifecycle.
- Attribute-change tests and emitted-event contract tests.
- Styling isolation checks against hostile host CSS.

## Links

- Related docs: `docs/Architecture.md` (section 3.9), `docs/project-plan.md` (Phase 6)
- Related issues/PRs: N/A (initial architecture baseline)
