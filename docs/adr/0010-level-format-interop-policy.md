# ADR 0010: Level format interoperability and import validation policy

**Status:** Accepted
**Date:** 2026-03-01
**Deciders:** Corgiban maintainers

## Context

Corgiban needs broad compatibility with existing Sokoban level packs and solution formats while
preserving a deterministic, minimal core engine. External formats (XSB/SOK/SLC) include tricky
whitespace, ragged rows, RLE, and variant markers that can silently change puzzle geometry if
handled incorrectly. The project also needs a clear place for format adapters so core logic does
not expand in scope.
Known-solution strings historically were normalized to uppercase, which loses push markers in
mixed-case solutions used by some Sokoban formats.

## Decision

- Keep CORG tokens as the canonical internal representation.
- `packages/core/encoding` handles CORG only.
- Introduce `packages/formats` for XSB/SOK/SLC import/export; it depends on `shared` + `levels`.
- `packages/formats` emits `LevelDefinition` / `LevelCollection` and does not require `core`.
- Support a documented SOK subset that covers pre-board title/comment metadata, positive-count
  RLE, row separators, and the implemented normalization rules.
- Import normalization rules:
  - Never trim rows; ragged rows allowed (pad to max width with floor).
  - Support interior empty rows via two-pass normalization.
  - Accept floor aliases `-` and `_` only in converters.
  - Reject tabs by default; never store tabs internally.
  - Use topology-aware crop (outside-void flood fill), not naive common-indent stripping.
  - Detect open/unclosed puzzles; reject by default with explicit override policies only.
  - Closed-puzzle validation yields warnings by default; strict mode optional.
  - Reject levels with all boxes on targets at start.
- Detect unsupported variants (numbered, multiban, hexoban, modern) and reject by default
  with optional metadata carry.
- Preserve knownSolution case (UDLR/udlr) to retain push markers and round-trip fidelity;
  normalization must not auto-uppercase. Internal solver output and replay always use
  uppercase-only directions; knownSolution is treated as direction-only after normalization.
- Apply a single hard-constraint set from `packages/shared/src/constraints.ts` across engine,
  import, and solver paths.

## Consequences

- Additional package and test surface area for formats.
- Cleaner boundaries: core remains deterministic and compact.
- Higher interop compatibility with explicit, auditable normalization rules.
- Import-time warnings/rejections become part of UX and must be surfaced clearly.
- External consumers expecting knownSolution to be uppercased must adapt to case-preserving
  normalization.

## Alternatives considered

- Switch canonical storage to XSB symbols everywhere.
- Put adapters inside `packages/core/src/encoding`.
- Implement only plain XSB rows (no SOK metadata, RLE, or row separators).
- Always accept open puzzles or silently auto-close them.
- Force knownSolution to uppercase only.

## Testing plan

- Import parsing and normalization tests (ragged rows, empty interior rows, crop rules).
- RLE and documented SOK subset coverage.
- Open/unclosed detection, closed-puzzle warnings, and strict-mode rejection tests.
- Variant detection and metadata carry behavior.
- Tab rejection and floor alias acceptance in converters.
- knownSolution case preservation and validation.

## Links

- `docs/Architecture.md` (format interop section)
- `docs/project-plan.md` (formats package and normalization rules)
- `packages/formats/docs/sok-grammar.md` (accepted SOK syntax and normalization contract)
- `artifacts/architecture-decisions.md`
