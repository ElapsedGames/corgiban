---
id: DEBT-007
title: best-practices report tooling is still stubbed end-to-end
type: debt
severity: medium
area: build
regression: false
status: deferred
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

Most of the `pnpm best-practices` pipeline is no longer stubbed: scanning, file analysis, and
report formatting are now implemented and covered by tests. The remaining gap is the top-level
`bestPracticesReport.run()` command, which still prints an "unavailable" message instead of
wiring scan/analyze/format together and writing a report artifact.

## Expected

The best-practices tooling should scan the configured source globs, analyze file size and
time-usage signals, format a real markdown report, and write it to the requested output
directory.

## Actual

The helper modules now implement their documented behavior, but `pnpm best-practices` still does
not produce a report file because the CLI entrypoint remains deferred.

Revalidated on 2026-03-07: running `pnpm best-practices` still prints
`best-practices report generation is unavailable. (requested out dir: docs/_generated/analysis)`
and exits without writing `docs/_generated/analysis/best_practices_report.md`.

## Repro

1. Run `pnpm best-practices`
2. Observe that no real report artifact is generated
3. Inspect `tools/src/bestPracticesReport.ts` and see that `run()` still logs the deferred path

## Notes

Found during a source scan for deferred inline notes and placeholder implementations.

Latest findings from the 2026-03-07 follow-up audit:

- The remaining work is not only the stubbed `run()` path in `tools/src/bestPracticesReport.ts`.
  The current helper implementations also drift from `docs/dev-tools-spec.md`.
- `tools/src/analyzeFiles.ts` currently classifies file sizes with `WARN_LINES = 300` and
  `FAIL_LINES = 550`, while the tooling spec documents internal buckets of `P <= 500`,
  `W = 501-800`, and `F > 800`.
- `tools/src/analyzeFiles.ts` currently flags time usage for any scanned file. The tooling spec
  scopes that signal to `packages/core/src/**` and `packages/solver/src/**` only.
- `tools/src/analyzeFiles.ts` currently returns `path.relative(...)` output directly. On Windows
  this yields backslashes, while the tooling spec calls for repo-root-relative POSIX paths in the
  report records.
- `tools/src/reportFormatter.ts` currently emits a compact plain-text list with `pass/warn/fail`
  labels and optional `[time]` markers. The tooling spec expects a fuller markdown artifact with:
  a generated timestamp, explicit warning/fail summaries, a legend defining the bucket meanings,
  and an informational time-usage section.
- Current `tools/` tests are green, but coverage is still mostly helper-level. There is still no
  end-to-end CLI test asserting that the report artifact is written to disk.

## Fix Plan

Bring the implementation back in line with `docs/dev-tools-spec.md`, then finish the CLI wiring:

- align `scanFiles` / `analyzeFiles` / `reportFormatter` with the documented thresholds, path
  formatting, time-usage scope, and report structure
- wire `tools/src/bestPracticesReport.ts` to scan, analyze, format, create the output directory,
  and write `best_practices_report.md`
- add an end-to-end command test that verifies the artifact is written, not just helper behavior

## Resolution

- Partial progress landed:
- `tools/src/analyzeFiles.ts`: real file reads, line counts, size-status classification, and
  time-usage detection now exist.
- `tools/src/scanFiles.ts`: glob-based file discovery is implemented with `fast-glob`.
- `tools/src/reportFormatter.ts`: report formatting now emits per-file rows with path, line
  count, status label, and `[time]` marker.
- `tools/src/bestPracticesReport.ts`: only `parseOutDir(...)` is implemented for now;
  `run()` still intentionally logs that report generation is unavailable.
- Tests now cover `analyzeFiles`, `reportFormatter`, and `parseOutDir`, but there is still no
  end-to-end command path producing a report artifact.

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
