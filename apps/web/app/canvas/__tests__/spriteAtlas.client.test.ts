import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SpriteAtlasWorkerMessage } from '../spriteAtlas.types';

type WorkerMockInstance = {
  onerror: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<SpriteAtlasWorkerMessage>) => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
};

function createWorkerMock() {
  const instances: WorkerMockInstance[] = [];

  class WorkerMock {
    onerror: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent<SpriteAtlasWorkerMessage>) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor(_url: string, _options?: { type?: 'module'; name?: string }) {
      instances.push(this as unknown as WorkerMockInstance);
    }
  }

  return {
    WorkerMock: WorkerMock as unknown as typeof Worker,
    instances,
  };
}

function installSpriteAtlasCapabilities(workerClass: typeof Worker): void {
  vi.stubGlobal('Worker', workerClass);
  vi.stubGlobal('OffscreenCanvas', class OffscreenCanvasMock {});
  vi.stubGlobal(
    'ImageBitmap',
    class ImageBitmapMock {
      close() {}
    },
  );
}

async function importSpriteAtlasModule(workerUrl = '/sprite-atlas-worker.js') {
  vi.doMock('../spriteAtlasWorker.client.ts?worker&url', () => ({
    default: workerUrl,
  }));
  return import('../spriteAtlas.client');
}

function createSpriteBitmapSet() {
  const floorClose = vi.fn();
  const wallClose = vi.fn();
  const targetClose = vi.fn();
  const boxClose = vi.fn();
  const boxOnTargetClose = vi.fn();
  const playerClose = vi.fn();
  const playerOnTargetClose = vi.fn();

  return {
    closeSpies: {
      floorClose,
      wallClose,
      targetClose,
      boxClose,
      boxOnTargetClose,
      playerClose,
      playerOnTargetClose,
    },
    sprites: {
      floor: { close: floorClose } as unknown as ImageBitmap,
      wall: { close: wallClose } as unknown as ImageBitmap,
      target: { close: targetClose } as unknown as ImageBitmap,
      box: { close: boxClose } as unknown as ImageBitmap,
      boxOnTarget: { close: boxOnTargetClose } as unknown as ImageBitmap,
      player: { close: playerClose } as unknown as ImageBitmap,
      playerOnTarget: { close: playerOnTargetClose } as unknown as ImageBitmap,
    },
  };
}

function getPostedRequest(
  worker: WorkerMockInstance,
  callIndex = worker.postMessage.mock.calls.length - 1,
) {
  return worker.postMessage.mock.calls[callIndex]?.[0] as {
    type: 'SPRITE_ATLAS_REQUEST';
    requestId: string;
    cellSize: number;
    dpr: number;
  };
}

describe('spriteAtlas.client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock('../spriteAtlasWorker.client.ts?worker&url');
    vi.resetModules();
  });

  it('reports pre-render support as false when capabilities are unavailable', async () => {
    vi.stubGlobal('Worker', undefined as unknown as typeof Worker);
    vi.stubGlobal('OffscreenCanvas', undefined as unknown as typeof OffscreenCanvas);
    vi.stubGlobal('ImageBitmap', undefined as unknown as typeof ImageBitmap);

    const { supportsOffscreenSpritePreRender } = await importSpriteAtlasModule();

    expect(supportsOffscreenSpritePreRender()).toBe(false);
  });

  it('returns null when capabilities are unavailable', async () => {
    vi.stubGlobal('Worker', undefined as unknown as typeof Worker);
    vi.stubGlobal('OffscreenCanvas', undefined as unknown as typeof OffscreenCanvas);
    vi.stubGlobal('ImageBitmap', undefined as unknown as typeof ImageBitmap);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    await expect(getSpriteAtlas(32, 2)).resolves.toBeNull();
  });

  it('returns null when worker URL resolves to empty string', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas } = await importSpriteAtlasModule('');

    await expect(getSpriteAtlas(24, 1)).resolves.toBeNull();
    expect(instances).toHaveLength(0);
  });

  it('reuses one dedicated worker across atlas requests with different keys', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { clearSpriteAtlasCache, getSpriteAtlas } = await importSpriteAtlasModule();

    const firstRequest = getSpriteAtlas(16, 1);
    expect(instances).toHaveLength(1);

    const worker = instances[0];
    const firstPostedRequest = getPostedRequest(worker);
    const firstBitmapSet = createSpriteBitmapSet();
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: firstPostedRequest.requestId,
        cellSize: 16,
        dpr: 1,
        sprites: firstBitmapSet.sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);

    await expect(firstRequest).resolves.toEqual({
      key: '16:1',
      sprites: firstBitmapSet.sprites,
    });
    expect(worker.terminate).not.toHaveBeenCalled();

    const secondRequest = getSpriteAtlas(20, 1);
    expect(instances).toHaveLength(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(2);

    const secondPostedRequest = getPostedRequest(worker);
    const secondBitmapSet = createSpriteBitmapSet();
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: secondPostedRequest.requestId,
        cellSize: 20,
        dpr: 1,
        sprites: secondBitmapSet.sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);

    await expect(secondRequest).resolves.toEqual({
      key: '20:1',
      sprites: secondBitmapSet.sprites,
    });
    expect(secondPostedRequest.requestId).not.toBe(firstPostedRequest.requestId);

    clearSpriteAtlasCache();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('reuses successful atlases for the same key and clears cached bitmaps', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas, clearSpriteAtlasCache } = await importSpriteAtlasModule();

    const first = getSpriteAtlas(16, 2);
    const second = getSpriteAtlas(16, 2);

    expect(second).toBe(first);
    expect(instances).toHaveLength(1);

    const worker = instances[0];
    const request = getPostedRequest(worker);
    const { sprites, closeSpies } = createSpriteBitmapSet();
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: request.requestId,
        cellSize: 16,
        dpr: 2,
        sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);

    await expect(first).resolves.toEqual({
      key: '16:2',
      sprites,
    });
    const third = await getSpriteAtlas(16, 2);
    expect(third).toEqual({
      key: '16:2',
      sprites,
    });
    expect(third).toBe(await first);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: 'SPRITE_ATLAS_REQUEST',
      requestId: expect.any(String),
      cellSize: 16,
      dpr: 2,
    });
    expect(worker.terminate).not.toHaveBeenCalled();
    expect(worker.onmessage).not.toBeNull();
    expect(worker.onerror).not.toBeNull();
    expect(instances).toHaveLength(1);

    clearSpriteAtlasCache();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(closeSpies.floorClose).toHaveBeenCalledTimes(1);
    expect(closeSpies.wallClose).toHaveBeenCalledTimes(1);
    expect(closeSpies.targetClose).toHaveBeenCalledTimes(1);
    expect(closeSpies.boxClose).toHaveBeenCalledTimes(1);
    expect(closeSpies.boxOnTargetClose).toHaveBeenCalledTimes(1);
    expect(closeSpies.playerClose).toHaveBeenCalledTimes(1);
    expect(closeSpies.playerOnTargetClose).toHaveBeenCalledTimes(1);
  });

  it('retries a key after a transient atlas failure', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    const firstAttempt = getSpriteAtlas(20, 1);
    const worker = instances[0];
    const firstRequest = getPostedRequest(worker);
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_ERROR',
        requestId: firstRequest.requestId,
        message: 'failed to render sprites',
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);
    await expect(firstAttempt).resolves.toBeNull();
    expect(worker.terminate).not.toHaveBeenCalled();

    const secondAttempt = getSpriteAtlas(20, 1);
    expect(instances).toHaveLength(1);
    expect(worker.postMessage).toHaveBeenCalledTimes(2);

    const secondRequest = getPostedRequest(worker);
    const { sprites } = createSpriteBitmapSet();
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: secondRequest.requestId,
        cellSize: 20,
        dpr: 1,
        sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);
    await expect(secondAttempt).resolves.toEqual({
      key: '20:1',
      sprites,
    });
  });

  it('returns null for malformed worker messages', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    const request = getSpriteAtlas(18, 1);
    const postedRequest = getPostedRequest(instances[0]);
    instances[0].onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: postedRequest.requestId,
        cellSize: 18,
        dpr: 1,
        sprites: {
          floor: { close: vi.fn() },
        },
      },
    } as unknown as MessageEvent<SpriteAtlasWorkerMessage>);

    await expect(request).resolves.toBeNull();
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('returns null for uncorrelated worker responses', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    const request = getSpriteAtlas(22, 1);
    const postedRequest = getPostedRequest(instances[0]);
    const { sprites } = createSpriteBitmapSet();
    instances[0].onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: `${postedRequest.requestId}-stale`,
        cellSize: 22,
        dpr: 1,
        sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);

    await expect(request).resolves.toBeNull();
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('returns null for mismatched atlas dimensions even when request ids match', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    const request = getSpriteAtlas(26, 2);
    const postedRequest = getPostedRequest(instances[0]);
    const { sprites } = createSpriteBitmapSet();
    instances[0].onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: postedRequest.requestId,
        cellSize: 26,
        dpr: 1,
        sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);

    await expect(request).resolves.toBeNull();
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('closes evicted atlases after release and clears remaining cached bitmaps', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { clearSpriteAtlasCache, getSpriteAtlas, releaseSpriteAtlas, retainSpriteAtlas } =
      await importSpriteAtlasModule();

    const firstRequest = getSpriteAtlas(12, 1);
    expect(instances).toHaveLength(1);
    const worker = instances[0];
    const firstBitmapSet = createSpriteBitmapSet();
    const firstPostedRequest = getPostedRequest(worker);
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: firstPostedRequest.requestId,
        cellSize: 12,
        dpr: 1,
        sprites: firstBitmapSet.sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);
    const firstAtlas = await firstRequest;
    expect(firstAtlas).not.toBeNull();
    retainSpriteAtlas(firstAtlas);

    const secondRequest = getSpriteAtlas(14, 1);
    const secondBitmapSet = createSpriteBitmapSet();
    expect(instances).toHaveLength(1);
    const secondPostedRequest = getPostedRequest(worker);
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: secondPostedRequest.requestId,
        cellSize: 14,
        dpr: 1,
        sprites: secondBitmapSet.sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);
    await expect(secondRequest).resolves.toEqual({
      key: '14:1',
      sprites: secondBitmapSet.sprites,
    });

    const thirdRequest = getSpriteAtlas(16, 1);
    const thirdBitmapSet = createSpriteBitmapSet();
    expect(instances).toHaveLength(1);
    const thirdPostedRequest = getPostedRequest(worker);
    worker.onmessage?.({
      data: {
        type: 'SPRITE_ATLAS_READY',
        requestId: thirdPostedRequest.requestId,
        cellSize: 16,
        dpr: 1,
        sprites: thirdBitmapSet.sprites,
      },
    } as MessageEvent<SpriteAtlasWorkerMessage>);
    await expect(thirdRequest).resolves.toEqual({
      key: '16:1',
      sprites: thirdBitmapSet.sprites,
    });

    expect(firstBitmapSet.closeSpies.floorClose).not.toHaveBeenCalled();
    expect(firstBitmapSet.closeSpies.playerOnTargetClose).not.toHaveBeenCalled();

    releaseSpriteAtlas(firstAtlas);
    expect(firstBitmapSet.closeSpies.floorClose).toHaveBeenCalledTimes(1);
    expect(firstBitmapSet.closeSpies.wallClose).toHaveBeenCalledTimes(1);
    expect(firstBitmapSet.closeSpies.targetClose).toHaveBeenCalledTimes(1);
    expect(firstBitmapSet.closeSpies.boxClose).toHaveBeenCalledTimes(1);
    expect(firstBitmapSet.closeSpies.boxOnTargetClose).toHaveBeenCalledTimes(1);
    expect(firstBitmapSet.closeSpies.playerClose).toHaveBeenCalledTimes(1);
    expect(firstBitmapSet.closeSpies.playerOnTargetClose).toHaveBeenCalledTimes(1);

    clearSpriteAtlasCache();
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.floorClose).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.wallClose).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.targetClose).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.boxClose).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.boxOnTargetClose).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.playerClose).toHaveBeenCalledTimes(1);
    expect(secondBitmapSet.closeSpies.playerOnTargetClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.floorClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.wallClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.targetClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.boxClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.boxOnTargetClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.playerClose).toHaveBeenCalledTimes(1);
    expect(thirdBitmapSet.closeSpies.playerOnTargetClose).toHaveBeenCalledTimes(1);
  });

  it('returns null for worker error events', async () => {
    const { WorkerMock, instances } = createWorkerMock();
    installSpriteAtlasCapabilities(WorkerMock);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    const fromOnError = getSpriteAtlas(21, 1);
    instances[0].onerror?.(new Event('error'));
    await expect(fromOnError).resolves.toBeNull();
    expect(instances[0].terminate).toHaveBeenCalledTimes(1);
  });

  it('swallows worker construction failures and resolves null', async () => {
    class ThrowingWorker {
      constructor(_url: string, _options?: { type?: 'module'; name?: string }) {
        throw new Error('Worker construction failed');
      }
    }

    installSpriteAtlasCapabilities(ThrowingWorker as unknown as typeof Worker);

    const { getSpriteAtlas } = await importSpriteAtlasModule();

    await expect(getSpriteAtlas(12, 1)).resolves.toBeNull();
  });
});
