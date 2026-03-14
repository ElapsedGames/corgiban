import { resolveBoardPalette } from './boardSkin';
import { renderBoardSvgTile } from './boardSvgTile';
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

async function drawSvgSprite(
  kind: SpriteKind,
  cellSize: number,
  dpr: number,
  request: SpriteAtlasRequestMessage,
): Promise<ImageBitmap> {
  const palette = resolveBoardPalette(request.skinId, request.mode);
  const pixelSize = Math.max(1, Math.round(cellSize * dpr));
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is unavailable for SVG sprite rendering.');
  }

  const svgMarkup = renderBoardSvgTile(kind, palette, pixelSize);
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
  return createImageBitmap(blob);
}

const scope = globalThis as unknown as WorkerScopeLike;

scope.addEventListener('message', (event) => {
  void (async () => {
    const request = event.data;
    if (!isSpriteAtlasRequestMessage(request)) {
      postWorkerError(scope, INVALID_REQUEST_ID, 'Invalid sprite atlas request message.');
      return;
    }

    try {
      const sprites = {
        floor: await drawSvgSprite('floor', request.cellSize, request.dpr, request),
        wall: await drawSvgSprite('wall', request.cellSize, request.dpr, request),
        target: await drawSvgSprite('target', request.cellSize, request.dpr, request),
        box: await drawSvgSprite('box', request.cellSize, request.dpr, request),
        boxOnTarget: await drawSvgSprite('boxOnTarget', request.cellSize, request.dpr, request),
        player: await drawSvgSprite('player', request.cellSize, request.dpr, request),
        playerOnTarget: await drawSvgSprite(
          'playerOnTarget',
          request.cellSize,
          request.dpr,
          request,
        ),
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
  })();
});
