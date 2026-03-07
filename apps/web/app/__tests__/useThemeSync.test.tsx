// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';

import { createAppStore } from '../state';
import { setTheme } from '../state/settingsSlice';
import { useThemeSync } from '../useThemeSync';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

function ThemeSyncProbe() {
  useThemeSync();
  return null;
}

async function renderWithStore(store: ReturnType<typeof createAppStore>): Promise<Root> {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <Provider store={store}>
        <ThemeSyncProbe />
      </Provider>,
    );
  });
  return root;
}

describe('useThemeSync', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore();
    // Reset html class to a neutral state before each test.
    document.documentElement.className = '';
  });

  afterEach(async () => {
    store.dispose();
    document.body.innerHTML = '';
    document.documentElement.className = '';
  });

  it('applies the initial theme from settings state to document.documentElement on mount', async () => {
    // settingsSlice defaults to 'light'
    const root = await renderWithStore(store);

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('applies dark class when theme state is dark', async () => {
    await act(async () => {
      store.dispatch(setTheme('dark'));
    });

    const root = await renderWithStore(store);

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('switches from light to dark when setTheme is dispatched', async () => {
    const root = await renderWithStore(store);

    expect(document.documentElement.classList.contains('light')).toBe(true);

    await act(async () => {
      store.dispatch(setTheme('dark'));
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('switches back from dark to light when setTheme is dispatched', async () => {
    await act(async () => {
      store.dispatch(setTheme('dark'));
    });

    const root = await renderWithStore(store);

    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await act(async () => {
      store.dispatch(setTheme('light'));
    });

    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('does not leave both light and dark classes simultaneously', async () => {
    const root = await renderWithStore(store);

    await act(async () => {
      store.dispatch(setTheme('dark'));
    });
    await act(async () => {
      store.dispatch(setTheme('light'));
    });

    const classes = Array.from(document.documentElement.classList);
    const themeClasses = classes.filter((c) => c === 'light' || c === 'dark');
    expect(themeClasses).toHaveLength(1);
    expect(themeClasses[0]).toBe('light');

    await act(async () => {
      root.unmount();
    });
  });
});
