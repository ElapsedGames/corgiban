// This worker is an app-local canvas helper, not the shared run-scoped solver/benchmark
// protocol from `packages/worker/protocol`, so it keeps a lightweight local validator here.
export const SPRITE_KINDS = [
  'floor',
  'wall',
  'target',
  'box',
  'boxOnTarget',
  'player',
  'playerOnTarget',
] as const;

export type SpriteKind = (typeof SPRITE_KINDS)[number];

export type SpriteAtlasRecord = Record<SpriteKind, ImageBitmap>;

export type SpriteAtlas = {
  key: string;
  sprites: SpriteAtlasRecord;
};

export type SpriteAtlasRequestMessage = {
  type: 'SPRITE_ATLAS_REQUEST';
  cellSize: number;
  dpr: number;
};

export type SpriteAtlasReadyMessage = {
  type: 'SPRITE_ATLAS_READY';
  cellSize: number;
  dpr: number;
  sprites: SpriteAtlasRecord;
};

export type SpriteAtlasErrorMessage = {
  type: 'SPRITE_ATLAS_ERROR';
  message: string;
};

export type SpriteAtlasWorkerMessage = SpriteAtlasReadyMessage | SpriteAtlasErrorMessage;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isImageBitmapLike(value: unknown): value is ImageBitmap {
  return isObjectRecord(value) && typeof value.close === 'function';
}

export function isSpriteAtlasRecord(value: unknown): value is SpriteAtlasRecord {
  if (!isObjectRecord(value)) {
    return false;
  }

  return SPRITE_KINDS.every((kind) => isImageBitmapLike(value[kind]));
}

export function isSpriteAtlasRequestMessage(value: unknown): value is SpriteAtlasRequestMessage {
  return (
    isObjectRecord(value) &&
    value.type === 'SPRITE_ATLAS_REQUEST' &&
    isPositiveFiniteNumber(value.cellSize) &&
    isPositiveFiniteNumber(value.dpr)
  );
}

export function isSpriteAtlasReadyMessage(value: unknown): value is SpriteAtlasReadyMessage {
  return (
    isObjectRecord(value) &&
    value.type === 'SPRITE_ATLAS_READY' &&
    isPositiveFiniteNumber(value.cellSize) &&
    isPositiveFiniteNumber(value.dpr) &&
    isSpriteAtlasRecord(value.sprites)
  );
}

export function isSpriteAtlasErrorMessage(value: unknown): value is SpriteAtlasErrorMessage {
  return (
    isObjectRecord(value) &&
    value.type === 'SPRITE_ATLAS_ERROR' &&
    typeof value.message === 'string'
  );
}

export function isSpriteAtlasWorkerMessage(value: unknown): value is SpriteAtlasWorkerMessage {
  return isSpriteAtlasReadyMessage(value) || isSpriteAtlasErrorMessage(value);
}
