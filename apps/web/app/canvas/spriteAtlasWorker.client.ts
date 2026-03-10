import { resolveBoardPalette } from './boardSkin';
import { SPRITE_KINDS, isSpriteAtlasRequestMessage } from './spriteAtlas.types';
import type {
  SpriteAtlasRequestMessage,
  SpriteAtlasErrorMessage,
  SpriteAtlasReadyMessage,
  SpriteAtlasWorkerMessage,
  SpriteKind,
} from './spriteAtlas.types';

type WorkerScopeLike = {
  addEventListener: (type: 'message', listener: (event: { data: unknown }) => void) => void;
  postMessage: (message: SpriteAtlasWorkerMessage, transfer?: Transferable[]) => void;
};

const INVALID_REQUEST_ID = 'invalid-request';

function postWorkerError(scope: WorkerScopeLike, requestId: string, message: string): void {
  const errorMessage: SpriteAtlasErrorMessage = {
    type: 'SPRITE_ATLAS_ERROR',
    requestId,
    message,
  };
  scope.postMessage(errorMessage);
}

function drawSprite(
  kind: SpriteKind,
  cellSize: number,
  dpr: number,
  request: SpriteAtlasRequestMessage,
): ImageBitmap {
  const palette = resolveBoardPalette(request.skinId, request.mode);
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(cellSize * dpr)),
    Math.max(1, Math.round(cellSize * dpr)),
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to acquire OffscreenCanvas 2D context.');
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cellSize, cellSize);

  if (kind === 'wall') {
    ctx.fillStyle = palette.wall;
    ctx.fillRect(0, 0, cellSize, cellSize);
    return canvas.transferToImageBitmap();
  }

  ctx.fillStyle = palette.floor;
  ctx.fillRect(0, 0, cellSize, cellSize);

  if (kind === 'target' || kind === 'boxOnTarget' || kind === 'playerOnTarget') {
    ctx.strokeStyle = palette.target;
    ctx.lineWidth = Math.max(2, cellSize * 0.08);
    const radius = cellSize * 0.22;
    ctx.beginPath();
    ctx.arc(cellSize / 2, cellSize / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (kind === 'box' || kind === 'boxOnTarget') {
    ctx.fillStyle = kind === 'boxOnTarget' ? palette.boxOnTarget : palette.box;
    const inset = cellSize * 0.14;
    ctx.fillRect(inset, inset, cellSize - inset * 2, cellSize - inset * 2);
  }

  if (kind === 'player' || kind === 'playerOnTarget') {
    ctx.fillStyle = palette.player;
    const radius = cellSize * 0.24;
    ctx.beginPath();
    ctx.arc(cellSize / 2, cellSize / 2, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas.transferToImageBitmap();
}

const scope = globalThis as unknown as WorkerScopeLike;

scope.addEventListener('message', (event) => {
  const request = event.data;
  if (!isSpriteAtlasRequestMessage(request)) {
    postWorkerError(scope, INVALID_REQUEST_ID, 'Invalid sprite atlas request message.');
    return;
  }

  try {
    const sprites = {
      floor: drawSprite('floor', request.cellSize, request.dpr, request),
      wall: drawSprite('wall', request.cellSize, request.dpr, request),
      target: drawSprite('target', request.cellSize, request.dpr, request),
      box: drawSprite('box', request.cellSize, request.dpr, request),
      boxOnTarget: drawSprite('boxOnTarget', request.cellSize, request.dpr, request),
      player: drawSprite('player', request.cellSize, request.dpr, request),
      playerOnTarget: drawSprite('playerOnTarget', request.cellSize, request.dpr, request),
    };

    const message: SpriteAtlasReadyMessage = {
      type: 'SPRITE_ATLAS_READY',
      requestId: request.requestId,
      skinId: request.skinId,
      mode: request.mode,
      cellSize: request.cellSize,
      dpr: request.dpr,
      sprites,
    };

    const transfers = SPRITE_KINDS.map((kind) => sprites[kind]);
    scope.postMessage(message, transfers);
  } catch (error) {
    postWorkerError(
      scope,
      request.requestId,
      error instanceof Error ? error.message : 'Unknown sprite atlas worker error.',
    );
  }
});
