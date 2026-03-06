# packages/formats

External Sokoban format adapters.

## Responsibilities

- Parse XSB, SOK 0.17, and SLC XML into `LevelDefinition`/`LevelCollection`-compatible data.
- Serialize internal levels to XSB, SOK 0.17, and SLC XML text.
- Normalize imported rows while preserving puzzle topology.
- Detect unsupported format variants and report explicit diagnostics.

## Validation notes

- `strictClosedValidation` is operational, not copy-only:
  it rejects closed puzzles that only become canonical after topology crop removes exterior floor
  padding.
- `parseSlcXml` uses a small XML parser rather than regex extraction, so standard quoted
  attributes, comments/declarations, and row tags with attributes are supported.

## Allowed imports

- `@corgiban/shared`
- `@corgiban/levels`

No imports from `@corgiban/core`, `@corgiban/solver`, or app packages.

## Public API

Exports from `src/index.ts`:

- `formatsVersion`
- `FormatId`
- `FormatParseWarning`
- `NormalizeImportedGridOptions`
- `NormalizeImportedGridResult`
- `ParseFormatOptions`
- `ParsedLevelCollection`
- `UnsupportedVariant`
- `normalizeImportedGrid`
- `parseXsb`
- `parseSok017`
- `parseSlcXml`
- `SerializeSok017Options`
- `serializeSok017`
- `SerializeSlcXmlOptions`
- `serializeSlcXml`
- `SerializeXsbOptions`
- `serializeXsb`

## Usage example

```ts
import { parseXsb, serializeSlcXml, serializeSok017, serializeXsb } from '@corgiban/formats';

const collection = parseXsb('#####\n#.@ #\n# $ #\n# . #\n#####', { collectionId: 'lab' });
const first = collection.levels[0];
const xsb = serializeXsb(first, { includeTitleComment: false });
const sok = serializeSok017(first);
const slc = serializeSlcXml(first);
```
