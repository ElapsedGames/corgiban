# ADR 0016: Benchmark report contract and versioning policy

**Status:** Accepted
**Date:** 2026-03-05
**Deciders:** Corgiban maintainers

## Context

Phase 4 delivered `/bench` import/export, worker-backed execution, and persistence. Follow-up review
identified contract drift risks:

- benchmark report metadata can diverge from the result set when suite builder state changes
- import/persistence validation is looser than the TypeScript benchmark record model
- report/version handling is too permissive for long-term compatibility
- level-pack import currently relies on permissive shape detection instead of typed/versioned payloads

We need an explicit artifact contract so benchmark results remain comparable and schema evolution is
intentional.

## Decision

- Benchmark report export uses a **history artifact contract** for the Phase 4 baseline.
  - payloads require `type`, `version`, and `exportModel`
  - `exportModel` is explicitly versioned and currently `"multi-suite-history"`
  - exported `results` represent retained benchmark history and may include multiple suite runs
- Benchmark reports are **typed and versioned**.
  - require `type: "corgiban-benchmark-report"` and `version`
  - require `exportModel` to match the supported model for that version
  - accept only explicitly supported versions; reject unsupported versions with explicit errors
- Benchmark result records from import/persistence must be validated by a **strict runtime parser**
  aligned with the model contract, including:
  - required solver options (`options`)
  - validated enum-like fields (`algorithmId`, `status`)
  - required metrics/environment structure
- Level-pack import remains a **compatibility baseline** in Phase 4:
  - accept either `levelIds: string[]` or `levels[].id` shapes
  - filter to recognized built-in level ids in `/bench`
  - typed/versioned level-pack contract hardening is deferred to Phase 6
- Persistence diagnostics in Phase 4 track storage permission outcome and surfaced persistence
  errors/notices; explicit repository durability health state is deferred to Phase 5.

## Consequences

**Positive:**

- Benchmark export/import semantics are explicit and testable (`type`/`version`/`exportModel`).
- Schema evolution is explicit and less likely to cause silent drift.
- Comparable benchmark analysis is safer across local persistence and shared reports.

**Negative:**

- Multi-suite history export does not carry a suite-start snapshot in Phase 4.
- Level-pack imports still allow legacy shape-based payloads until Phase 6 hardening.
- Additional parser/test maintenance is required when versions evolve.

## Rollout plan (if applicable)

- Phase 5:
  - surface persistence durability health in diagnostics (`durable | memory-fallback | unavailable`,
    or equivalent)
- Phase 6:
  - evaluate optional single-suite export artifact mode in addition to history export, if needed
  - enforce strict versioned level-pack parsing
  - add `/bench` warm-up controls and represent warm-up/measurement semantics clearly

## Testing plan

- Add parser tests for supported/unsupported benchmark report versions.
- Add regression tests for unsupported/invalid `exportModel` values.
- Add regression tests for missing/invalid required benchmark fields (including `options`).
- Add level-pack parser tests for accepted baseline shapes and future type/version rejection paths.
- Add UI/workflow tests for export artifact semantics and diagnostics mode visibility.

## Links

- `docs/project-plan.md` (Phase 5 Task 6; Phase 6 Tasks 10-11)
- `docs/Architecture.md` (sections 3.14 and 9.4-9.6)
- `docs/adr/0014-benchmark-worker-cancellation-semantics.md`
