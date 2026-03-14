import spriteAtlasWorkerUrl from './spriteAtlasWorker.client.ts?worker&url';
import {
  DEFAULT_BOARD_RENDER_MODE,
  DEFAULT_BOARD_SKIN_ID,
  makeBoardSkinKey,
  type BoardRenderMode,
  type BoardSkinId,
} from './boardSkin';
import type { SpriteAtlas, SpriteAtlasRequestMessage } from './spriteAtlas.types';
import { isSpriteAtlasWorkerMessage } from './spriteAtlas.types';

type SpriteAtlasWorkerLike = Pick<Worker, 'onerror' | 'onmessage' | 'postMessage' | 'terminate'>;

type PendingAtlasCacheEntry = {
  key: string;
  status: 'pending';
  lastUsedSequence: number;
  promise: Promise<SpriteAtlas | null>;
};

type ReadyAtlasCacheEntry = {
  key: string;
  status: 'ready';
  lastUsedSequence: number;
  atlas: SpriteAtlas;
};

type AtlasCacheEntry = PendingAtlasCacheEntry | ReadyAtlasCacheEntry;

type AtlasLifecycleState = {
  retainCount: number;
  closeWhenReleased: boolean;
  closed: boolean;
};

type PendingWorkerRequest = {
  key: string;
  skinId: BoardSkinId;
  mode: BoardRenderMode;
  cellSize: number;
  dpr: number;
  resolve: (atlas: SpriteAtlas | null) => void;
};

// Keep only the most recent atlas pairs hot; older bitmaps are large enough that
// session-long retention is not worth the memory cost.
const MAX_CACHED_SPRITE_ATLASES = 2;

const atlasCache = new Map<string, AtlasCacheEntry>();
const atlasLifecycle = new WeakMap<SpriteAtlas, AtlasLifecycleState>();
const pendingWorkerRequests = new Map<string, PendingWorkerRequest>();
let atlasUseSequence = 0;
let atlasRequestSequence = 0;
let spriteAtlasWorker: SpriteAtlasWorkerLike | null = null;

function nextAtlasUseSequence(): number {
  atlasUseSequence += 1;
  return atlasUseSequence;
}

function nextAtlasRequestId(key: string): string {
  atlasRequestSequence += 1;
  return `${key}:${atlasRequestSequence}`;
}

function isReadyAtlasCacheEntry(entry: AtlasCacheEntry): entry is ReadyAtlasCacheEntry {
  return entry.status === 'ready';
}

function getOrCreateAtlasLifecycleState(atlas: SpriteAtlas): AtlasLifecycleState {
  const existing = atlasLifecycle.get(atlas);
  if (existing) {
    return existing;
  }

  const created: AtlasLifecycleState = {
    retainCount: 0,
    closeWhenReleased: false,
    closed: false,
  };
  atlasLifecycle.set(atlas, created);
  return created;
}

function closeAtlasBitmaps(atlas: SpriteAtlas): void {
  const lifecycle = getOrCreateAtlasLifecycleState(atlas);
  if (lifecycle.closed) {
    return;
  }

  Object.values(atlas.sprites).forEach((bitmap) => {
    bitmap.close();
  });
  lifecycle.closed = true;
}

function scheduleAtlasCleanup(atlas: SpriteAtlas): void {
  const lifecycle = getOrCreateAtlasLifecycleState(atlas);
  if (lifecycle.retainCount > 0) {
    lifecycle.closeWhenReleased = true;
    return;
  }

  closeAtlasBitmaps(atlas);
}

function evictSpriteAtlas(key: string, entry: ReadyAtlasCacheEntry): void {
  if (atlasCache.get(key) !== entry) {
    return;
  }

  atlasCache.delete(key);
  scheduleAtlasCleanup(entry.atlas);
}

function enforceSpriteAtlasCacheLimit(): void {
  const readyEntries = Array.from(atlasCache.entries()).filter(
    (entry): entry is [string, ReadyAtlasCacheEntry] => isReadyAtlasCacheEntry(entry[1]),
  );
  const overflowCount = readyEntries.length - MAX_CACHED_SPRITE_ATLASES;
  if (overflowCount <= 0) {
    return;
  }

  readyEntries
    .sort((left, right) => left[1].lastUsedSequence - right[1].lastUsedSequence)
    .slice(0, overflowCount)
    .forEach(([key, entry]) => {
      evictSpriteAtlas(key, entry);
    });
}

function cacheSpriteAtlas(key: string, atlas: SpriteAtlas): SpriteAtlas {
  getOrCreateAtlasLifecycleState(atlas);
  atlasCache.set(key, {
    key,
    status: 'ready',
    lastUsedSequence: nextAtlasUseSequence(),
    atlas,
  });
  enforceSpriteAtlasCacheLimit();
  return atlas;
}

export function supportsOffscreenSpritePreRender(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof ImageBitmap !== 'undefined' &&
    typeof createImageBitmap === 'function'
  );
}

function detachSpriteAtlasWorker(): void {
  if (!spriteAtlasWorker) {
    return;
  }

  spriteAtlasWorker.onerror = null;
  spriteAtlasWorker.onmessage = null;
  spriteAtlasWorker.terminate();
  spriteAtlasWorker = null;
}

function resetSpriteAtlasWorker(): void {
  const pendingRequests = Array.from(pendingWorkerRequests.values());
  pendingWorkerRequests.clear();
  detachSpriteAtlasWorker();

  pendingRequests.forEach((pendingRequest) => {
    pendingRequest.resolve(null);
  });
}

function resolvePendingWorkerRequest(requestId: string, atlas: SpriteAtlas | null): void {
  const pendingRequest = pendingWorkerRequests.get(requestId);
  if (!pendingRequest) {
    return;
  }

  pendingWorkerRequests.delete(requestId);
  pendingRequest.resolve(atlas);
}

function handleSpriteAtlasWorkerMessage(event: MessageEvent<unknown>): void {
  const message = event.data;
  if (!isSpriteAtlasWorkerMessage(message)) {
    resetSpriteAtlasWorker();
    return;
  }

  const pendingRequest = pendingWorkerRequests.get(message.requestId);
  if (!pendingRequest) {
    resetSpriteAtlasWorker();
    return;
  }

  if (message.type !== 'SPRITE_ATLAS_READY') {
    resolvePendingWorkerRequest(message.requestId, null);
    return;
  }

  if (
    message.skinId !== pendingRequest.skinId ||
    message.mode !== pendingRequest.mode ||
    message.cellSize !== pendingRequest.cellSize ||
    message.dpr !== pendingRequest.dpr
  ) {
    resetSpriteAtlasWorker();
    return;
  }

  resolvePendingWorkerRequest(message.requestId, {
    key: pendingRequest.key,
    sprites: message.sprites,
  });
}

function ensureSpriteAtlasWorker(): SpriteAtlasWorkerLike {
  if (spriteAtlasWorker) {
    return spriteAtlasWorker;
  }

  const worker = new Worker(spriteAtlasWorkerUrl, {
    type: 'module',
    name: 'corgiban-sprite-atlas',
  });
  worker.onerror = () => {
    resetSpriteAtlasWorker();
  };
  worker.onmessage = handleSpriteAtlasWorkerMessage;
  spriteAtlasWorker = worker;
  return worker;
}

function requestSpriteAtlas(
  cellSize: number,
  dpr: number,
  skinId: BoardSkinId,
  mode: BoardRenderMode,
): Promise<SpriteAtlas | null> {
  if (!supportsOffscreenSpritePreRender()) {
    return Promise.resolve(null);
  }

  if (spriteAtlasWorkerUrl.length === 0) {
    return Promise.resolve(null);
  }

  const key = makeBoardSkinKey(skinId, mode, cellSize, dpr);
  const requestId = nextAtlasRequestId(key);

  return new Promise((resolve) => {
    const request: SpriteAtlasRequestMessage = {
      type: 'SPRITE_ATLAS_REQUEST',
      requestId,
      skinId,
      mode,
      cellSize,
      dpr,
    };

    pendingWorkerRequests.set(requestId, {
      key,
      skinId,
      mode,
      cellSize,
      dpr,
      resolve,
    });

    try {
      ensureSpriteAtlasWorker().postMessage(request);
    } catch {
      resetSpriteAtlasWorker();
    }
  });
}

export function getSpriteAtlas(
  cellSize: number,
  dpr: number,
  skinId: BoardSkinId = DEFAULT_BOARD_SKIN_ID,
  mode: BoardRenderMode = DEFAULT_BOARD_RENDER_MODE,
): Promise<SpriteAtlas | null> {
  const key = makeBoardSkinKey(skinId, mode, cellSize, dpr);
  const cached = atlasCache.get(key);
  if (cached) {
    cached.lastUsedSequence = nextAtlasUseSequence();
    return cached.status === 'ready' ? Promise.resolve(cached.atlas) : cached.promise;
  }

  const pendingEntry: PendingAtlasCacheEntry = {
    key,
    status: 'pending',
    lastUsedSequence: nextAtlasUseSequence(),
    promise: Promise.resolve(null),
  };

  pendingEntry.promise = requestSpriteAtlas(cellSize, dpr, skinId, mode)
    .then((atlas) => {
      if (atlasCache.get(key) !== pendingEntry) {
        if (atlas) {
          scheduleAtlasCleanup(atlas);
        }
        return null;
      }

      if (!atlas) {
        atlasCache.delete(key);
        return null;
      }

      return cacheSpriteAtlas(key, atlas);
    })
    .catch(() => {
      if (atlasCache.get(key) === pendingEntry) {
        atlasCache.delete(key);
      }
      return null;
    });

  atlasCache.set(key, pendingEntry);
  return pendingEntry.promise;
}

export function retainSpriteAtlas(atlas: SpriteAtlas | null | undefined): void {
  if (!atlas) {
    return;
  }

  const lifecycle = getOrCreateAtlasLifecycleState(atlas);
  if (lifecycle.closed) {
    return;
  }

  lifecycle.retainCount += 1;
}

export function releaseSpriteAtlas(atlas: SpriteAtlas | null | undefined): void {
  if (!atlas) {
    return;
  }

  const lifecycle = atlasLifecycle.get(atlas);
  if (!lifecycle || lifecycle.closed) {
    return;
  }

  lifecycle.retainCount = Math.max(0, lifecycle.retainCount - 1);
  if (lifecycle.retainCount === 0 && lifecycle.closeWhenReleased) {
    closeAtlasBitmaps(atlas);
  }
}

export function clearSpriteAtlasCache(): void {
  atlasCache.forEach((entry, key) => {
    if (entry.status === 'ready') {
      evictSpriteAtlas(key, entry);
      return;
    }

    atlasCache.delete(key);
  });
  resetSpriteAtlasWorker();
  atlasUseSequence = 0;
  atlasRequestSequence = 0;
}
