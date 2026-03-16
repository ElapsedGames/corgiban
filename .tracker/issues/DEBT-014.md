---
id: DEBT-014
title: Embed package exists but still lacks a fleshed-out host-facing example and rollout path
type: debt
severity: low
area: embed
regression: false
status: deferred
discovered_at: 2026-03-15
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

`packages/embed` ships the core `<corgiban-embed>` web component, but the repo still lacks a
polished first-party example page, distribution/bootstrapping guidance for host sites, and a clear
product decision on whether embed should remain package-only or become a visible app feature.

## Expected

Embedding should have a small but complete host-consumer story:

- at least one maintained first-party example page or fixture
- clear copy-paste setup docs for host pages
- explicit positioning relative to the main Remix app (`apps/web`)

## Actual

The package README documents the API and a minimal usage snippet, but the current app does not ship
an official embed-example surface, and embed remains easy to forget during product planning even
though the package is still present and tested.

## Repro

1. Inspect `packages/embed/README.md` and the package source.
2. Compare that package-level API to the current first-party app routes in `apps/web`.
3. Note that there is no maintained, public, app-hosted example route or fuller rollout guidance
   for consumers beyond the basic package snippet.

## Notes

- Current implementation references:
  - `packages/embed/src/corgibanEmbed.tsx`
  - `packages/embed/src/EmbedView.tsx`
  - `packages/embed/README.md`
- Current product/docs references:
  - `docs/Architecture.md`
  - `docs/project-plan.md`

## Fix Plan

- Decide whether embed stays package-only or should gain a first-party hosted example flow.
- If it stays package-only, expand the README with a fuller host-page setup and publishing story.
- If it becomes a visible app feature, add a maintained example/demo route that does not distort
  the play/bench/lab route charters.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
