# packages/embed

Web Component adapter for embedding Corgiban in host pages.

## Responsibilities

- Register `<corgiban-embed>` custom element.
- Mount a minimal React subtree inside Shadow DOM.
- Inject scoped styles and cleanly unmount on disconnect.
- Dispatch embed events (`corgiban:error`, `corgiban:move`, `corgiban:solved`,
  `corgiban:benchmarkComplete`).

## Public API

Exports from `src/index.ts`:

- `embedVersion`
- `EMBED_ELEMENT_TAG`
- `CorgibanEmbedElement`
- `defineCorgibanEmbed()`

Supported element attributes:

- `level-id`
- `level-data` (JSON string payload)
- `readonly`
- `show-solver`
- `theme`

Level resolution precedence:

- A known built-in `level-id` wins and `level-data` is ignored.
- When `level-id` is missing or unknown, the embed attempts to resolve `level-data`.
- When neither source resolves to a valid level, the embed renders an explicit invalid state and
  dispatches `corgiban:error`.
- Invalid `level-data` is reported only when it is the active fallback source.

Dispatched DOM events:

- `corgiban:error`
- `corgiban:move`
- `corgiban:solved`
- `corgiban:benchmarkComplete`
  Known-solution playback uses this event with `detail.synthetic === true`; it is not a real
  benchmark completion signal.

## Usage example

```ts
import { defineCorgibanEmbed, EMBED_ELEMENT_TAG } from '@corgiban/embed';

defineCorgibanEmbed();

const element = document.createElement(EMBED_ELEMENT_TAG);
element.setAttribute('level-id', 'corgiban-test-18');
element.setAttribute('show-solver', '');
document.body.append(element);
```

## Allowed imports

- React runtime dependencies
- Public entrypoints from workspace packages

`packages/embed` is an adapter package and must not be imported by domain packages.
