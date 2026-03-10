# packages/levels

Built-in level data and schema helpers.

## Responsibilities

- Provide the built-in launch catalog sourced from `packages/levels/src/corgibanTestLevels.ts`
- Define `LevelDefinition` and helpers for row token validation and knownSolution normalization
- Keep the shipped launch pack in one explicit file so future ordering edits stay localized

## Public API surface

Exported from `src/index.ts`:

- `levelsVersion`
- `builtinLevels`
- `builtinLevelsByCategory`
- `LevelDefinition`
- `normalizeKnownSolution`
- `normalizeLevelDefinition`
- `validateRowTokens`

## Built-in catalog notes

- The shipped launch catalog currently lives in one explicit `launchLevels` list in
  `src/corgibanTestLevels.ts`.
- Built-in ids are currently sequential `corgiban-test-N` values in launch order; treat them as a
  pre-launch catalog that may still change before the first public release.
- Shipped rows use literal spaces as the canonical empty-floor token, keep `rows` arrays multiline
  for readability, and wall off exterior void instead of relying on open floor padding.
- Use `pnpm levels:rank` from the repo root to benchmark the built-in catalog and suggest a launch
  ordering with the default solve-first difficulty heuristic.

## LevelDefinition conventions

- `rows` tokens: `W`, `E`, `T`, `P`, `B`, `S`, `Q`, and space
- Empty floor accepts both `E` and literal space; literal space is the preferred canonical/serialized form. `S` = target + box, `Q` = target + player (parsing details, not new cell kinds)
- Rows may be ragged on the right and optionally indented; core `parseLevel` strips common leading whitespace and pads missing cells with spaces
- `knownSolution` accepts `UDLR` and `udlr` only; case is preserved for round-trip fidelity (lowercase = move, uppercase = push in SOK convention)
- After normalization, `null` means no usable known solution (absent, empty, or failed validation); `undefined` only means the field was not present in the source pre-normalization
- External adapters (packages/formats) may accept `-`/`_` as floor and other format tokens; internal schema remains strict and tabs are rejected
- Built-in ids should remain unique; the current pre-launch catalog follows the sequential
  `corgiban-test-N` convention
