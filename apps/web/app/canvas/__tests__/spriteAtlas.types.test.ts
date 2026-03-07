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
        requestId: 'atlas-1',
        cellSize: 24,
        dpr: 2,
      }),
    ).toBe(true);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_READY',
        requestId: 'atlas-1',
        cellSize: 24,
        dpr: 2,
        sprites: createSpriteRecord(),
      }),
    ).toBe(true);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_ERROR',
        requestId: 'atlas-1',
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
        requestId: '',
        cellSize: 24,
        dpr: 2,
      }),
    ).toBe(false);

    expect(
      isSpriteAtlasWorkerMessage({
        type: 'SPRITE_ATLAS_READY',
        requestId: 'atlas-1',
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
        requestId: 'atlas-1',
        message: 42,
      }),
    ).toBe(false);
  });
});
