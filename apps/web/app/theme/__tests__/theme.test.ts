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

describe('theme helpers', () => {
  beforeEach(() => {
    document.documentElement.className = 'light';
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
    expect(
      resolveThemePreference({
        localStorage: {
          getItem: () => null,
          setItem: () => undefined,
        },
        matchMedia: () => ({ matches: true }),
      }),
    ).toBe('dark');
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

  it('applies the stored theme in the inline init script', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    new Function(buildThemeInitScript())();

    expect(getDocumentTheme()).toBe('dark');
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
});
