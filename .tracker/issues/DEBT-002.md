---
id: DEBT-002
title: Lab draft-input vs active-level contract is ambiguous on failed parse
type: debt
severity: low
area: lab
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

ADR-0023 says stale worker results should be ignored after parse, import, or cancel transitions.
But authoredRevision only advances and active runs are only cancelled inside commitParsedLevel().
On a failed parse, the previously committed active level can still complete an in-flight solve or
bench run and update status. This may be intentional but the contract is undocumented and untested.

## Expected

The contract should be explicit: either solve/bench always operate on the last successfully parsed
level (current behavior), or failed-parse transitions must invalidate active run tokens.

## Actual

Failed parse does not cancel in-flight runs. UI shows "Active level" which may mislead users.

## Notes

Source: Review 5 #3. useLabOrchestration.ts:120-161. LabEditorPanel.tsx:61-64.
ADR-0023:23-29, :61-66.

## Fix Plan

Document the accepted contract in ADR-0023 or review-notes.md. Add a test that verifies
in-flight run behavior on failed parse. No code change may be needed if behavior is intentional.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
