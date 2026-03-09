export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'corgiban-theme';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type ThemeWindowLike = {
  localStorage?: StorageLike;
  matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>;
};

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark';
}

export function readStoredTheme(storage: StorageLike | null | undefined): AppTheme | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function resolveThemePreference(windowLike: ThemeWindowLike | null | undefined): AppTheme {
  const storedTheme = readStoredTheme(windowLike?.localStorage);

  if (storedTheme) {
    return storedTheme;
  }

  const prefersDark = windowLike?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  return prefersDark ? 'dark' : 'light';
}

export function getDocumentTheme(doc: Document | null | undefined = globalThis.document): AppTheme {
  if (!doc?.documentElement) {
    return 'light';
  }

  return doc.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setDocumentTheme(
  theme: AppTheme,
  doc: Document | null | undefined = globalThis.document,
): void {
  if (!doc?.documentElement) {
    return;
  }

  doc.documentElement.classList.remove('light', 'dark');
  doc.documentElement.classList.add(theme);
}

export function persistTheme(theme: AppTheme, storage: StorageLike | null | undefined): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore persistence failures so theme toggling still works in restricted environments.
  }
}

export function buildThemeInitScript(): string {
  return `(function(){var theme='light';try{var stored=window.localStorage?window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}):null;if(stored==='light'||stored==='dark'){theme=stored;}else{var media=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;theme=media&&media.matches?'dark':'light';}}catch(error){var fallbackMedia=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;theme=fallbackMedia&&fallbackMedia.matches?'dark':'light';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);}());`;
}
