---
id: DEBT-017
title: encoding-check.mjs silently skips null-byte files instead of hard-failing
type: debt
severity: low
area: build
regression: false
status: open
discovered_at: 2026-03-16
introduced_in: null
branch: null
pr: null
commit: null
owner: null
fixed_at: null
fixed_by: null
---

## Summary

`tools/scripts/encoding-check.mjs` line 169-171 uses `buffer.includes(0)` to detect null bytes
and silently `continue`s past those files. A file containing null bytes is not checked for any
encoding violations.

## Expected

Null-byte files should hard-fail the encoding check (or at minimum warn), not silently pass.

## Actual

Files with null bytes are skipped entirely - no error, no warning.

## Notes

Binary files (images, wasm, etc.) are already excluded by the ignore list. A text file with a
null byte is unusual and likely indicates corruption or an accidentally committed binary.

## Fix Plan

Change the `continue` to an error report. Optionally add a binary-file allowlist for known
extensions if false positives arise.

## Resolution

(fill in when closing)

## Verification

- [ ] test added or updated
- [ ] manual verification completed
- [ ] docs updated if needed
