// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  THEME_STORAGE_KEY,
  buildThemeInitScript,
  getDocumentTheme,
  persistTheme,
  readStoredTheme,
  resolveThemePreference,
  setDocumentTheme,
} from '../theme';

const originalLocalStorage = window.localStorage;

describe('theme helpers', () => {
  beforeEach(() => {
    document.documentElement.className = 'light';
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

  it('no-ops when the document is unavailable', () => {
    expect(() => setDocumentTheme('dark', null)).not.toThrow();
    expect(getDocumentTheme(null)).toBe('light');
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

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('dark');
  });

  it('respects a stored light theme in the inline init script', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('light');
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
