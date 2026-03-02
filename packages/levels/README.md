# packages/levels

Built-in level data and schema helpers.

## Responsibilities

- Provide the built-in level catalog sourced from `packages/levels/src/builtinLevels.ts`
- Define `LevelDefinition` and helpers for row token validation and knownSolution normalization

## Public API surface

Exported from `src/index.ts`:

- `levelsVersion`
- `builtinLevels`
- `builtinLevelsByCategory`
- `LevelDefinition`
- `normalizeKnownSolution`
- `normalizeLevelDefinition`
- `validateRowTokens`

## LevelDefinition conventions

- `rows` tokens: `W`, `E`, `T`, `P`, `B`, `S`, `Q`, and space
- Space is empty floor; `S` = target + box, `Q` = target + player (parsing details, not new cell kinds)
- Rows may be ragged on the right and optionally indented; core `parseLevel` strips common leading whitespace and pads missing cells with spaces
- `knownSolution` accepts `UDLR` and `udlr` only; case is preserved for round-trip fidelity (lowercase = move, uppercase = push in SOK convention)
- After normalization, `null` means no usable known solution (absent, empty, or failed validation); `undefined` only means the field was not present in the source pre-normalization
- External adapters (packages/formats) may accept `-`/`_` as floor and other format tokens; internal schema remains strict and tabs are rejected
- Built-in ids/names: `id = {category}-{NNN}` (zero-padded 3 digits, 1-based), `name = {Category} {N}`
