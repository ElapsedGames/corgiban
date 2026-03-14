// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BOARD_SKIN_STORAGE_KEY,
  BoardSkinPreferenceProvider,
  persistBoardSkin,
  readStoredBoardSkin,
  useAppBoardSkin,
  useBoardSkinPreference,
  type UseAppBoardSkinResult,
} from '../useAppBoardSkin';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];
const hookState: {
  current: UseAppBoardSkinResult | null;
  preference: 'classic' | 'legacy' | null;
} = {
  current: null,
  preference: null,
};

function BoardSkinConsumer() {
  hookState.current = useAppBoardSkin();
  hookState.preference = useBoardSkinPreference().boardSkinId;
  return null;
}

function BoardSkinHarness({ providedSkinId }: { providedSkinId?: 'classic' | 'legacy' }) {
  if (!providedSkinId) {
    return <BoardSkinConsumer />;
  }

  return (
    <BoardSkinPreferenceProvider boardSkinId={providedSkinId}>
      <BoardSkinConsumer />
    </BoardSkinPreferenceProvider>
  );
}

async function renderHarness(providedSkinId?: 'classic' | 'legacy') {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<BoardSkinHarness providedSkinId={providedSkinId} />);
  });
}

describe('useAppBoardSkin', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
    hookState.current = null;
    hookState.preference = null;
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
    vi.restoreAllMocks();
  });

  it('reads a stored board-skin preference after mount', async () => {
    window.localStorage.setItem(BOARD_SKIN_STORAGE_KEY, 'legacy');

    await renderHarness();

    expect(hookState.current?.isBoardSkinReady).toBe(true);
    expect(hookState.current?.boardSkinId).toBe('legacy');
    expect(hookState.preference).toBe('classic');
  });

  it('falls back to the default skin when localStorage is blocked at access time', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    await renderHarness();

    expect(hookState.current?.isBoardSkinReady).toBe(true);
    expect(hookState.current?.boardSkinId).toBe('classic');

    await act(async () => {
      hookState.current?.toggleBoardSkin();
    });

    expect(hookState.current?.boardSkinId).toBe('legacy');
  });

  it('toggles and persists the board-skin preference', async () => {
    await renderHarness('legacy');

    expect(hookState.preference).toBe('legacy');
    expect(hookState.current?.boardSkinId).toBe('classic');

    await act(async () => {
      hookState.current?.toggleBoardSkin();
    });

    expect(hookState.current?.boardSkinId).toBe('legacy');
    expect(window.localStorage.getItem(BOARD_SKIN_STORAGE_KEY)).toBe('legacy');

    await act(async () => {
      hookState.current?.toggleBoardSkin();
    });

    expect(hookState.current?.boardSkinId).toBe('classic');
    expect(window.localStorage.getItem(BOARD_SKIN_STORAGE_KEY)).toBe('classic');
  });
});

describe('useAppBoardSkin storage helpers', () => {
  it('returns null for missing, invalid, or unreadable stored values', () => {
    expect(readStoredBoardSkin(null)).toBeNull();
    expect(
      readStoredBoardSkin({
        getItem: () => 'invalid',
        setItem: () => undefined,
      }),
    ).toBeNull();
    expect(
      readStoredBoardSkin({
        getItem: () => {
          throw new Error('blocked');
        },
        setItem: () => undefined,
      }),
    ).toBeNull();
  });

  it('writes valid values and ignores unavailable or restricted storage', () => {
    const writes: string[] = [];

    persistBoardSkin('legacy', {
      getItem: () => null,
      setItem: (_key, value) => {
        writes.push(value);
      },
    });
    persistBoardSkin('classic', undefined);
    persistBoardSkin('classic', {
      getItem: () => null,
      setItem: () => {
        throw new Error('blocked');
      },
    });

    expect(writes).toEqual(['legacy']);
  });
});
