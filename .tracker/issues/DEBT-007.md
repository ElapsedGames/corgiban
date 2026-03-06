---
id: DEBT-007
title: best-practices report tooling is still stubbed end-to-end
type: debt
severity: medium
area: build
regression: false
status: open
discovered_at: 2026-03-06
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

The `pnpm best-practices` pipeline is still stubbed across `tools/src`. `scanFiles()` ignores its
inputs and returns `[]`, `analyzeFile()` emits zero-line pass records with no time-usage data,
`formatReport()` emits only a timestamp and count, and `bestPracticesReport.run()` logs that report
generation is unavailable instead of writing a report artifact.

## Expected

The best-practices tooling should scan the configured source globs, analyze file size and
time-usage signals, format a real markdown report, and write it to the requested output
directory.

## Actual

The command completes without producing the intended report content, and the helper functions do
not implement their documented behavior.

## Repro

1. Run `pnpm best-practices`
2. Observe that no real report data is generated
3. Inspect `tools/src` and see each stage still returns stub output

## Notes

Found during a source scan for deferred inline notes and placeholder implementations.

## Fix Plan

Implement the full report pipeline in `tools/src/scanFiles.ts`, `tools/src/analyzeFiles.ts`,
`tools/src/reportFormatter.ts`, and `tools/src/bestPracticesReport.ts`, then replace the tracked
markers with real behavior and coverage.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
