# packages/levels

Built-in level data and schema helpers.

## Responsibilities

- Provide the built-in level catalog sourced from `packages/levels/src/builtinLevels.ts`
- Define `LevelDefinition` and helpers for row token validation and knownSolution normalization

## Public API surface

Exported from `src/index.ts`:

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
- `knownSolution` normalized to uppercase `UDLR` with no whitespace; invalid or empty becomes `null`, `undefined` means not tested
- Built-in ids/names: `id = {category}-{NNN}` (zero-padded 3 digits, 1-based), `name = {Category} {N}`
