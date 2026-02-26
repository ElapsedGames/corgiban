# packages/core

Pure, deterministic game engine and level runtime representation.

## Responsibilities

- Parsing/serializing level encoding (editor-friendly rows -> runtime)
- Core model types (cells, directions, positions)
- Pure engine operations:
  - create/restart/undo
  - applyMove
  - win detection
  - legal move computation (optional)

## Allowed imports

- `packages/shared` - types, invariants, result helpers, constraints
- `packages/levels` - level definitions and schema

No other workspace packages. No DOM, no Web APIs, no React.

## Hard constraints

- Deterministic and side-effect free
- `Date` and `Date.now` are banned - wall-clock time is sourced through `packages/shared/src/time.ts` if needed
- `parseLevel` must enforce size constraints defined in `packages/shared/src/constraints.ts` (`MAX_GRID_WIDTH`, `MAX_GRID_HEIGHT`, `MAX_BOXES`) and reject malformed input with a descriptive error

## Public API surface

Export from `src/index.ts` only. Keep other modules internal.

## Testing

- Coverage target: **98-100%** (enforced in CI)
- Tests must validate all invariants (no overlapping boxes, player not on wall, boxes not on walls)
- Regression tests required for bug fixes
