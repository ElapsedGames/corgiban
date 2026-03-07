# SOK Grammar Contract

This document defines the SOK text accepted by `parseSok017(...)` and emitted by
`serializeSok017(...)`.

It documents the current Corgiban contract. It does not claim compatibility with every historical
SOK dialect or every metadata field seen in the wild.

## Scope

- Parser entrypoint: `packages/formats/src/parseSok017.ts`
- Serializer entrypoint: `packages/formats/src/serializeSok017.ts`
- Grid normalization/invariants: `packages/formats/src/normalizeGrid.ts`

## Accepted syntax

At a high level:

```text
document     = *(blank-line) level-block *(blank-line+ level-block) *(blank-line)
level-block  = *(header-line) 1*(board-line)
header-line  = comment-title / title-line
comment-title = ';' text
title-line   = 'Title' [space]* ':' text
board-line   = 1*(board-token / repeat-count / row-separator)
repeat-count = positive integer
row-separator = '|'
```

Rules:

- Blank lines separate levels.
- `; ...` comment lines may appear before the first board line of a level and act as title
  metadata. The last non-empty pre-board comment wins.
- `Title: ...` lines may appear before the first board line of a level and act as title metadata.
  The last non-empty pre-board `Title:` line wins.
- Semicolon comment lines that appear after board rows start are ignored.
- `Title:` lines that appear after board rows start are invalid.
- A board line may be plain XSB tokens, RLE-compressed tokens, or a mix of both.
- Digits always mean RLE repeat counts in SOK input. They are not preserved as board cells and are
  not available for numbered-variant detection in this format.

## Accepted board tokens

`parseSok017(...)` accepts these board tokens before normalization:

| Token | Meaning          | Normalized cell |
| ----- | ---------------- | --------------- |
| `#`   | wall             | `W`             |
| `.`   | target           | `T`             |
| `@`   | player           | `P`             |
| `+`   | player on target | `Q`             |
| `$`   | box              | `B`             |
| `*`   | box on target    | `S`             |
| ` `   | floor            | `E`             |
| `-`   | floor alias      | `E`             |
| `_`   | floor alias      | `E`             |

Unsupported-variant markers such as letters, `<`, `>`, `^`, `v`, `=`, and `&` are rejected by
default. When `allowUnsupportedVariants: true` is set, they are sanitized to floor and surfaced as
warnings.

## RLE and row separators

- A positive integer before a token repeats that token.
- A positive integer before `|` repeats the row separator.
- `|` ends the current decoded row.
- Repeated separators can create empty decoded rows; those rows are still subject to normal puzzle
  validation and topology crop.
- A trailing digit with no following token is invalid.
- A repeat count of `0` is invalid.
- Decoded width, height, and repeat counts must stay within the shared import limits.

Example:

```text
Title: Packed
5#|#.@ #|# $ #|# . #|5#
```

decodes to:

```text
#####
#.@ #
# $ #
# . #
#####
```

## Normalization rules

After block parsing, the decoded board goes through `normalizeImportedGrid(...)`.

- Raw board-line whitespace is preserved long enough to keep ragged geometry intact.
- Ragged rows are allowed; missing cells are treated as floor during normalization.
- Exterior floor is removed with topology-aware crop, not simple common-indent trimming.
- Open puzzles are rejected by default and allowed only with `allowOpenPuzzles: true`.
- `strictClosedValidation: true` rejects closed puzzles that only become canonical after exterior
  floor crop.
- Tabs are invalid.
- Imported levels must contain exactly one player.
- Imported levels with all boxes already on targets are invalid.
- `parseSok017(...)` always returns `knownSolution: null`; it does not parse or emit solution
  metadata.

## Invalid syntax

These inputs are rejected:

- Non-blank, non-comment, non-`Title:` lines outside the board grammar.
- `Title:` lines that appear after board rows start.
- Trailing RLE digits such as `3`.
- Zero-count RLE such as `0#`.
- Tabs inside board content.
- Levels that fail the shared normalization rules (open puzzle, invalid player count, size limits,
  and so on).

## Serializer contract

`serializeSok017(...)` emits a canonical subset:

- Optional `Title: <level.name>` line (enabled by default).
- One decoded board row per line using XSB tokens.
- No RLE compression.
- No comments.
- No solution metadata.

This means parse/serialize round-trips preserve normalized board geometry, but not original SOK
formatting choices such as RLE usage, floor aliases, or comment placement.

## Examples

Valid:

```text
; Demo
5#|#@-_#|#$. #|5#
```

Valid:

```text
Title: First
#####
#.@ #
# $ #
# . #
#####

Title: Second
#####
#@  #
# $.#
#####
```

Invalid:

```text
Title: Broken
3
```

Invalid:

```text
#####
Title: Late
#@  #
# $.#
#####
```
