# packages/shared

Shared primitive types and hard constraints used across workspace packages.

## Responsibilities

- Define cross-package constants in `constraints.ts`
- Define canonical shared types such as `Direction`
- Stay dependency-free so all other packages can consume the same boundary-safe primitives

## Public API

Exports from `src/index.ts`:

- `sharedVersion`
- `Direction`
- `MAX_GRID_WIDTH`
- `MAX_GRID_HEIGHT`
- `MAX_BOXES`
- `MAX_BENCH_SUITE_LEVELS`
- `MAX_IMPORT_BYTES`

## Allowed imports

None. `packages/shared` is the bottom of the workspace dependency graph.

## Usage example

```ts
import { MAX_IMPORT_BYTES, type Direction } from '@corgiban/shared';

function isDirection(value: string): value is Direction {
  return value === 'U' || value === 'D' || value === 'L' || value === 'R';
}

if (payloadSize > MAX_IMPORT_BYTES) {
  throw new Error('Import payload is too large.');
}
```
