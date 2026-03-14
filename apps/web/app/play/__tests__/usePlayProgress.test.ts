// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockedBuiltinLevels = vi.hoisted(() => ({
  firstLevel: {
    id: 'test-level-1',
    name: 'First Test Level',
    rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
  },
  secondLevel: {
    id: 'test-level-2',
    name: 'Second Test Level',
    rows: ['WWWWW', 'WPEEW', 'WETBW', 'WWWWW'],
  },
}));

vi.mock('@corgiban/levels', async (importOriginal: () => Promise<unknown>) => {
  const actual = (await importOriginal()) as typeof import('@corgiban/levels');
  return {
    ...actual,
    builtinLevels: [mockedBuiltinLevels.firstLevel, mockedBuiltinLevels.secondLevel],
    builtinLevelsByCategory: {
      test: [mockedBuiltinLevels.firstLevel, mockedBuiltinLevels.secondLevel],
    },
  };
});

import {
  createLegacyPlayableExactLevelKey,
  createPlayableExactLevelKey,
} from '../../levels/playableIdentity';
import {
  PLAY_PROGRESS_STORAGE_KEY,
  persistPlayProgress,
  readStoredPlayProgress,
  usePlayProgress,
  type StoredPlayLevel,
  type UsePlayProgressResult,
} from '../usePlayProgress';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];
const hookState: { current: UsePlayProgressResult | null } = {
  current: null,
};

function ProgressHarness() {
  hookState.current = usePlayProgress();
  return null;
}

function renderHarness() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  act(() => {
    root.render(createElement(ProgressHarness));
  });
}

describe('usePlayProgress storage helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    window.localStorage.clear();
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      act(() => {
        root?.unmount();
      });
    }
    vi.useRealTimers();
    hookState.current = null;
  });

  it('reads and writes the expected version 2 progress payload shape', () => {
    const progress = {
      version: 2 as const,
      lastPlayedLevel: {
        levelRef: 'builtin:test-level-2',
        levelId: 'test-level-2',
      },
      completedLevelIds: ['test-level-1', 'test-level-2'],
      updatedAtIso: '2026-03-13T00:00:00.000Z',
    };

    persistPlayProgress(progress, window.localStorage);

    expect(window.localStorage.getItem(PLAY_PROGRESS_STORAGE_KEY)).toContain('test-level-2');
    expect(readStoredPlayProgress(window.localStorage)).toEqual(progress);
  });

  it('migrates legacy version 1 progress into version 2 built-in level ids', () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        lastPlayedLevel: {
          levelRef: 'builtin:test-level-2',
          levelId: 'test-level-2',
          exactLevelKey: createLegacyPlayableExactLevelKey(mockedBuiltinLevels.secondLevel),
        },
        completedExactLevelKeys: [
          createLegacyPlayableExactLevelKey(mockedBuiltinLevels.firstLevel),
          createPlayableExactLevelKey(mockedBuiltinLevels.secondLevel),
          'missing-exact-key',
        ],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );

    expect(readStoredPlayProgress(window.localStorage)).toEqual({
      version: 2,
      lastPlayedLevel: {
        levelRef: 'builtin:test-level-2',
        levelId: 'test-level-2',
      },
      completedLevelIds: ['test-level-1', 'test-level-2'],
      updatedAtIso: '2026-03-13T00:00:00.000Z',
    });
  });

  it('rejects incompatible or malformed stored payloads', () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 99,
        lastPlayedLevel: { levelRef: 'builtin:test-level-1' },
        completedLevelIds: ['test-level-1'],
      }),
    );
    expect(readStoredPlayProgress(window.localStorage)).toBeNull();

    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: { levelRef: 'builtin:test-level-1' },
        completedLevelIds: ['test-level-1'],
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );
    expect(readStoredPlayProgress(window.localStorage)).toEqual({
      version: 2,
      lastPlayedLevel: null,
      completedLevelIds: ['test-level-1'],
      updatedAtIso: '2026-03-13T00:00:00.000Z',
    });
  });

  it('sanitizes malformed arrays, invalid timestamps, and unreadable storage', () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: null,
        completedLevelIds: ['test-level-1', 2, 'test-level-1', 'test-level-2'],
        updatedAtIso: 123,
      }),
    );

    expect(readStoredPlayProgress(window.localStorage)).toEqual({
      version: 2,
      lastPlayedLevel: null,
      completedLevelIds: ['test-level-1', 'test-level-2'],
      updatedAtIso: '1970-01-01T00:00:00.000Z',
    });
    expect(readStoredPlayProgress(null)).toBeNull();
    expect(
      readStoredPlayProgress({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => undefined,
      }),
    ).toBeNull();
  });

  it('ignores invalid JSON and storage write failures', () => {
    window.localStorage.setItem(PLAY_PROGRESS_STORAGE_KEY, '{invalid');

    expect(readStoredPlayProgress(window.localStorage)).toBeNull();
    expect(() =>
      persistPlayProgress(
        {
          version: 2,
          lastPlayedLevel: null,
          completedLevelIds: [],
          updatedAtIso: '2026-03-13T00:00:00.000Z',
        },
        undefined,
      ),
    ).not.toThrow();

    expect(() =>
      persistPlayProgress(
        {
          version: 2,
          lastPlayedLevel: null,
          completedLevelIds: [],
          updatedAtIso: '2026-03-13T00:00:00.000Z',
        },
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('blocked');
          },
        },
      ),
    ).not.toThrow();
  });

  it('treats primitive and malformed last-played levels as absent', () => {
    window.localStorage.setItem(
      PLAY_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        lastPlayedLevel: 7,
        completedLevelIds: null,
        updatedAtIso: '2026-03-13T00:00:00.000Z',
      }),
    );

    expect(readStoredPlayProgress(window.localStorage)).toEqual({
      version: 2,
      lastPlayedLevel: null,
      completedLevelIds: [],
      updatedAtIso: '2026-03-13T00:00:00.000Z',
    });
  });
});

describe('usePlayProgress hook', () => {
  const builtinLevel: StoredPlayLevel = {
    levelRef: 'builtin:test-level-1',
    levelId: 'test-level-1',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-13T00:00:00.000Z'));
    document.body.innerHTML = '';
    window.localStorage.clear();
    hookState.current = null;
  });

  afterEach(() => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      act(() => {
        root?.unmount();
      });
    }
    vi.useRealTimers();
    hookState.current = null;
    vi.restoreAllMocks();
  });

  it('initializes an empty progress record when storage is empty', () => {
    renderHarness();

    expect(hookState.current?.isPlayProgressReady).toBe(true);
    expect(hookState.current?.playProgress).toEqual({
      version: 2,
      lastPlayedLevel: null,
      completedLevelIds: [],
      updatedAtIso: '1970-01-01T00:00:00.000Z',
    });
  });

  it('remembers the last played level and does not churn timestamps for duplicate updates', () => {
    renderHarness();

    act(() => {
      hookState.current?.rememberLastPlayedLevel(builtinLevel);
    });

    expect(hookState.current?.playProgress?.lastPlayedLevel).toEqual(builtinLevel);
    expect(hookState.current?.playProgress?.updatedAtIso).toBe('2026-03-13T00:00:00.000Z');

    vi.setSystemTime(new Date('2026-03-13T01:00:00.000Z'));
    act(() => {
      hookState.current?.rememberLastPlayedLevel(builtinLevel);
    });

    expect(hookState.current?.playProgress?.updatedAtIso).toBe('2026-03-13T00:00:00.000Z');
    expect(readStoredPlayProgress(window.localStorage)?.lastPlayedLevel).toEqual(builtinLevel);
  });

  it('marks completed built-in levels once and keeps duplicate completions deduplicated', () => {
    renderHarness();

    act(() => {
      hookState.current?.markCompletedLevel('test-level-1');
    });

    expect(hookState.current?.playProgress?.completedLevelIds).toEqual(['test-level-1']);

    vi.setSystemTime(new Date('2026-03-13T02:00:00.000Z'));
    act(() => {
      hookState.current?.markCompletedLevel('test-level-1');
      hookState.current?.markCompletedLevel('test-level-2');
    });

    expect(hookState.current?.playProgress?.completedLevelIds).toEqual([
      'test-level-1',
      'test-level-2',
    ]);
    expect(readStoredPlayProgress(window.localStorage)?.completedLevelIds).toEqual([
      'test-level-1',
      'test-level-2',
    ]);
    expect(hookState.current?.playProgress?.updatedAtIso).toBe('2026-03-13T02:00:00.000Z');
  });

  it('tolerates an invalid null-like last-played update without changing progress', () => {
    renderHarness();

    act(() => {
      (
        hookState.current?.rememberLastPlayedLevel as unknown as
          | ((level: StoredPlayLevel | null) => void)
          | undefined
      )?.(null);
    });

    expect(hookState.current?.playProgress).toEqual({
      version: 2,
      lastPlayedLevel: null,
      completedLevelIds: [],
      updatedAtIso: '1970-01-01T00:00:00.000Z',
    });
  });

  it('falls back to in-memory defaults when localStorage is blocked at access time', () => {
    const localStorageGetter = vi.spyOn(window, 'localStorage', 'get');
    localStorageGetter.mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    renderHarness();

    expect(hookState.current?.isPlayProgressReady).toBe(true);
    expect(hookState.current?.playProgress).toEqual({
      version: 2,
      lastPlayedLevel: null,
      completedLevelIds: [],
      updatedAtIso: '1970-01-01T00:00:00.000Z',
    });

    act(() => {
      hookState.current?.rememberLastPlayedLevel(builtinLevel);
      hookState.current?.markCompletedLevel('test-level-1');
    });

    expect(hookState.current?.playProgress).toEqual({
      version: 2,
      lastPlayedLevel: builtinLevel,
      completedLevelIds: ['test-level-1'],
      updatedAtIso: '2026-03-13T00:00:00.000Z',
    });
  });
});
