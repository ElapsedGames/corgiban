// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { THEME_STORAGE_KEY } from '../theme';
import { useAppTheme, type UseAppThemeResult } from '../useAppTheme';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

const hookState: { current: UseAppThemeResult | null } = {
  current: null,
};

function ThemeHarness() {
  hookState.current = useAppTheme();
  return null;
}

async function renderHarness() {
  const container = document.createElement('div');
  document.body.append(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<ThemeHarness />);
  });
}

describe('useAppTheme', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.className = 'light';
    window.localStorage.clear();
    hookState.current = null;
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('adopts the current document theme after mount', async () => {
    document.documentElement.className = 'dark';

    await renderHarness();

    expect(hookState.current?.isThemeReady).toBe(true);
    expect(hookState.current?.theme).toBe('dark');
  });

  it('toggles the theme class and persists the new preference', async () => {
    await renderHarness();

    await act(async () => {
      hookState.current?.toggleTheme();
    });

    expect(hookState.current?.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });
});
