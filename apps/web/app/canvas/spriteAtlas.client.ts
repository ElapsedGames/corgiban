import spriteAtlasWorkerUrl from './spriteAtlasWorker.client.ts?worker&url';
import type { SpriteAtlas, SpriteAtlasRequestMessage } from './spriteAtlas.types';
import { isSpriteAtlasWorkerMessage } from './spriteAtlas.types';

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

// Keep only the most recent atlas pairs hot; older bitmaps are large enough that
// session-long retention is not worth the memory cost.
const MAX_CACHED_SPRITE_ATLASES = 2;

const atlasCache = new Map<string, AtlasCacheEntry>();
const atlasLifecycle = new WeakMap<SpriteAtlas, AtlasLifecycleState>();
let atlasUseSequence = 0;

function makeAtlasKey(cellSize: number, dpr: number): string {
  return `${cellSize}:${dpr}`;
}

function nextAtlasUseSequence(): number {
  atlasUseSequence += 1;
  return atlasUseSequence;
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
    typeof ImageBitmap !== 'undefined'
  );
}

function requestSpriteAtlas(cellSize: number, dpr: number): Promise<SpriteAtlas | null> {
  if (!supportsOffscreenSpritePreRender()) {
    return Promise.resolve(null);
  }

  if (spriteAtlasWorkerUrl.length === 0) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const worker = new Worker(spriteAtlasWorkerUrl, {
      type: 'module',
      name: 'corgiban-sprite-atlas',
    });

    const cleanup = () => {
      worker.onerror = null;
      worker.onmessage = null;
      worker.terminate();
    };

    worker.onerror = () => {
      cleanup();
      resolve(null);
    };

    worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!isSpriteAtlasWorkerMessage(message)) {
        cleanup();
        resolve(null);
        return;
      }

      if (message.type === 'SPRITE_ATLAS_READY') {
        const key = makeAtlasKey(message.cellSize, message.dpr);
        cleanup();
        resolve({
          key,
          sprites: message.sprites,
        });
        return;
      }

      cleanup();
      resolve(null);
    };

    const request: SpriteAtlasRequestMessage = {
      type: 'SPRITE_ATLAS_REQUEST',
      cellSize,
      dpr,
    };

    worker.postMessage(request);
  });
}

export function getSpriteAtlas(cellSize: number, dpr: number): Promise<SpriteAtlas | null> {
  const key = makeAtlasKey(cellSize, dpr);
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

  pendingEntry.promise = requestSpriteAtlas(cellSize, dpr)
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
  atlasUseSequence = 0;
}
