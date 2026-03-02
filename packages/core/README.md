# packages/core

Pure, deterministic game engine and level runtime representation.

## Responsibilities

- Parsing/serializing CORG level encoding (editor-friendly rows -> runtime) via `parseLevel`/`serializeLevel`
- External format adapters (XSB/SOK/SLC) live in `packages/formats`, not `core/encoding`
- Core model types (cells, directions, positions, runtime state)
- Pure engine operations:
  - createGame
  - applyMove
  - undo/restart
  - win detection
- Hashing utilities for solver use (`normalize`, `hash`)
- `LevelRuntime` includes immutable `levelId` metadata sourced from `LevelDefinition.id`

## Allowed imports

- `packages/shared` - types, invariants, result helpers, constraints
- `packages/levels` - level definitions and schema

No other workspace packages. No DOM, no Web APIs, no React.

## Hard constraints

- Deterministic and side-effect free
- Typed arrays returned by core (for example `GameState.boxes` and `LevelRuntime.initialBoxes`) are treated as immutable snapshots. Consumers must not mutate them; structural sharing is relied on for non-push moves.
- `Date` and `Date.now` are banned - wall-clock time is sourced through `packages/shared/src/time.ts` if needed
- `parseLevel` must enforce size constraints defined in `packages/shared/src/constraints.ts` (`MAX_GRID_WIDTH`, `MAX_GRID_HEIGHT`, `MAX_BOXES`) and reject malformed input with a descriptive error
- `parseLevel` normalizes rows by stripping common leading whitespace and right-padding ragged rows with spaces (spaces are floor)
- `parseLevel` rejects tabs and levels with no non-empty rows
- `parseLevel` rejects levels with all boxes on targets at start

## Public API surface

Export from `src/index.ts` only. Keep other modules internal.

Public exports include:

- Types: `Cell`, `FloorType`, `Occupant`, `LevelRuntime`, `GameState`, `Direction`, `Position`
- Functions: `createGame`, `applyMove`, `undo`, `restart`, `isWin`, `parseLevel`, `serializeLevel`, `normalize`, `hash`, `isWall`

## Testing

- Coverage gate: **95%** (enforced in CI); overall aim is for 98-100%
- Tests must validate all invariants (player not on wall, player not on a box, no overlapping boxes, boxes not on walls)
- Regression tests required for bug fixes
