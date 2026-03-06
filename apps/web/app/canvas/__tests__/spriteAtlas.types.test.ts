import { describe, expect, it, vi } from 'vitest';

import {
  SPRITE_KINDS,
  isSpriteAtlasRequestMessage,
  isSpriteAtlasWorkerMessage,
} from '../spriteAtlas.types';

function createSpriteRecord() {
  return Object.fromEntries(
    SPRITE_KINDS.map((kind) => [kind, { close: vi.fn() } as unknown as ImageBitmap]),
  );
}

describe('spriteAtlas.types', () => {
  it('accepts valid app-local request and response messages', () => {
    expect(
      isSpriteAtlasRequestMessage({
        type: 'SPRITE_ATLAS_REQUEST',
        cellSize: 24,
        dpr: 2,
      }),
    ).toBe(true);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_READY',
        cellSize: 24,
        dpr: 2,
        sprites: createSpriteRecord(),
      }),
    ).toBe(true);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_ERROR',
        message: 'failed to render sprites',
      }),
    ).toBe(true);
  });

  it('rejects malformed request and response messages', () => {
    expect(
      isSpriteAtlasRequestMessage({
        type: 'SPRITE_ATLAS_REQUEST',
        cellSize: 0,
        dpr: 2,
      }),
    ).toBe(false);

    expect(
      isSpriteAtlasRequestMessage({
        type: 'SPRITE_ATLAS_REQUEST',
        cellSize: 24,
      }),
    ).toBe(false);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_READY',
        cellSize: 24,
        dpr: 2,
        sprites: {
          floor: { close: vi.fn() },
        },
      }),
    ).toBe(false);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_ERROR',
        message: 42,
      }),
    ).toBe(false);
  });
});
