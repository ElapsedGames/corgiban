---
id: DEBT-001
title: SOK adapter does not match full SOK 0.17 grammar claim in docs
type: debt
severity: medium
area: formats
regression: false
status: open
discovered_at: 2026-03-06
introduced_in: phase6
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

parseSok017 only accepts board rows, blank lines, ; comments, and Title:. serializeSok017 emits
only Title: plus raw rows. If the PR or docs claim "full SOK 0.17 grammar", real-world SOK files
will fail import and the contract claim will draw review pushback.

## Expected

Either the implementation actually supports the full SOK 0.17 grammar, or the docs/README narrow
the claim to "subset" or "basic SOK format".

## Actual

Implementation is a subset but documentation may claim full support.

## Repro

Attempt to import a SOK file that uses extended metadata fields beyond Title:.

## Notes

Sources: Review 2 and Principal/QA review.

- `packages/formats/src/parseSok017.ts:128-154` only accepts board lines, blank lines, `;`
  comments, and `Title:`.
- `packages/formats/src/serializeSok017.ts:13-15` emits only title plus rows.
- The stronger claim appears in `docs/project-plan.md` and `docs/Architecture.md`, so this is a
  documentation/contract honesty problem unless the parser/serializer grows into the full grammar.

## Fix Plan

- Either narrow the docs/README/plan language to match the implemented subset
- Or expand the parser/serializer and add tests until the "full SOK 0.17 grammar" claim is true

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
