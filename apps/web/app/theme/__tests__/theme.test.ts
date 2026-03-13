// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_CHROME_COLOR_TOKEN,
  THEME_STORAGE_KEY,
  THEME_COLOR_META_NAME,
  buildThemeInitScript,
  getDocumentTheme,
  persistTheme,
  readDocumentThemeColor,
  readStoredTheme,
  resolveThemePreference,
  setDocumentTheme,
  syncDocumentThemeColor,
} from '../theme';

const originalLocalStorage = window.localStorage;

describe('theme helpers', () => {
  beforeEach(() => {
    document.documentElement.className = 'light';
    document.documentElement.style.removeProperty(BROWSER_CHROME_COLOR_TOKEN);
    document.head
      .querySelectorAll(`meta[name="${THEME_COLOR_META_NAME}"]`)
      .forEach((meta) => meta.remove());
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: false })),
    });
  });

  it('reads only valid stored themes', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme(window.localStorage)).toBe('dark');

    window.localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readStoredTheme(window.localStorage)).toBeNull();
  });

  it('returns null when no storage is available', () => {
    expect(readStoredTheme(null)).toBeNull();
  });

  it('returns null when reading storage throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
    };

    expect(readStoredTheme(storage)).toBeNull();
  });

  it('prefers stored theme over matchMedia', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));

    expect(
      resolveThemePreference({
        localStorage: {
          getItem: () => 'light',
          setItem: () => undefined,
        },
        matchMedia,
      }),
    ).toBe('light');
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it('falls back to prefers-color-scheme when no stored theme exists', () => {
    const matchMedia = vi.fn(() => ({ matches: true }));

    expect(
      resolveThemePreference({
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
        },
        matchMedia,
      }),
    ).toBe('dark');
    expect(matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
  });

  it('defaults to light when no stored theme or media preference exists', () => {
    expect(
      resolveThemePreference({ localStorage: { getItem: () => null, setItem: () => undefined } }),
    ).toBe('light');
  });

  it('swaps the root html theme class', () => {
    setDocumentTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getDocumentTheme()).toBe('dark');

    setDocumentTheme('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists explicit user theme choices when storage is available', () => {
    persistTheme('dark', window.localStorage);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('reads the browser chrome theme color from the token layer', () => {
    document.documentElement.style.setProperty(BROWSER_CHROME_COLOR_TOKEN, '#123456');

    expect(readDocumentThemeColor()).toBe('#123456');
  });

  it('syncs meta[name="theme-color"] from the browser chrome token', () => {
    document.documentElement.style.setProperty(BROWSER_CHROME_COLOR_TOKEN, '#123456');

    syncDocumentThemeColor();

    expect(
      document.querySelector(`meta[name="${THEME_COLOR_META_NAME}"]`)?.getAttribute('content'),
    ).toBe('#123456');
  });

  it('reuses an existing theme-color meta element instead of appending a duplicate', () => {
    const existingMeta = document.createElement('meta');
    existingMeta.name = THEME_COLOR_META_NAME;
    existingMeta.content = '#000000';
    document.head.appendChild(existingMeta);
    document.documentElement.style.setProperty(BROWSER_CHROME_COLOR_TOKEN, '#abcdef');

    syncDocumentThemeColor();

    expect(document.head.querySelectorAll(`meta[name="${THEME_COLOR_META_NAME}"]`)).toHaveLength(1);
    expect(existingMeta.getAttribute('content')).toBe('#abcdef');
  });

  it('returns null for blank browser chrome token values and leaves theme-color unchanged', () => {
    const existingMeta = document.createElement('meta');
    existingMeta.name = THEME_COLOR_META_NAME;
    existingMeta.content = '#123456';
    document.head.appendChild(existingMeta);
    document.documentElement.style.setProperty(BROWSER_CHROME_COLOR_TOKEN, '   ');

    expect(readDocumentThemeColor()).toBeNull();

    syncDocumentThemeColor();

    expect(existingMeta.getAttribute('content')).toBe('#123456');
  });

  it('no-ops when theme-color sync is asked to use a document without a head', () => {
    const docWithoutHead = {
      head: null,
      documentElement: document.documentElement,
      querySelector: vi.fn(() => null),
      createElement: vi.fn(),
    } as unknown as Document;

    expect(() =>
      syncDocumentThemeColor(docWithoutHead, {
        getComputedStyle: () => ({
          getPropertyValue: () => '#123456',
        }),
      }),
    ).not.toThrow();
  });

  it('no-ops when the document is unavailable', () => {
    expect(() => setDocumentTheme('dark', null)).not.toThrow();
    expect(getDocumentTheme(null)).toBe('light');
    expect(readDocumentThemeColor(null)).toBeNull();
    expect(() => syncDocumentThemeColor(null)).not.toThrow();
  });

  it('tolerates missing storage when persisting explicit theme choices', () => {
    expect(() => persistTheme('dark', null)).not.toThrow();
  });

  it('swallows storage write failures while keeping theme changes synchronous', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota exceeded');
      },
    };

    expect(() => persistTheme('dark', storage)).not.toThrow();
  });

  it('applies the stored theme in the inline init script', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    document.documentElement.style.setProperty(BROWSER_CHROME_COLOR_TOKEN, '#0b1120');

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('dark');
    expect(
      document.querySelector(`meta[name="${THEME_COLOR_META_NAME}"]`)?.getAttribute('content'),
    ).toBe('#0b1120');
  });

  it('respects a stored light theme in the inline init script', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: true })),
    });
    document.documentElement.style.setProperty(BROWSER_CHROME_COLOR_TOKEN, '#f8fafc');

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('light');
    expect(
      document.querySelector(`meta[name="${THEME_COLOR_META_NAME}"]`)?.getAttribute('content'),
    ).toBe('#f8fafc');
  });

  it('falls back to prefers-color-scheme in the inline init script when storage is empty', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('dark');
  });

  it('defaults the inline init script to light when storage is empty and media prefers light', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: false })),
    });

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('light');
  });

  it('uses the system preference when localStorage throws during theme bootstrap', () => {
    const getItem = vi.fn(() => {
      throw new Error('blocked');
    });
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem,
        setItem: vi.fn(),
        clear: vi.fn(),
        removeItem: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    new Function(buildThemeInitScript())();

    expect(getItem).toHaveBeenCalledWith(THEME_STORAGE_KEY);
    expect(getDocumentTheme()).toBe('dark');
  });
});
