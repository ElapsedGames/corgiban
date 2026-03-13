export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'corgiban-theme';
export const THEME_COLOR_META_NAME = 'theme-color';
export const BROWSER_CHROME_COLOR_TOKEN = '--color-browser-chrome';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type ThemeWindowLike = {
  localStorage?: StorageLike;
  matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>;
  getComputedStyle?: (element: Element) => Pick<CSSStyleDeclaration, 'getPropertyValue'>;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
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

function getThemeColorMeta(doc: Document): HTMLMetaElement | null {
  return doc.querySelector(`meta[name="${THEME_COLOR_META_NAME}"]`);
}

function ensureThemeColorMeta(doc: Document): HTMLMetaElement | null {
  if (!doc.head) {
    return null;
  }

  const existingMeta = getThemeColorMeta(doc);
  if (existingMeta) {
    return existingMeta;
  }

  const meta = doc.createElement('meta');
  meta.name = THEME_COLOR_META_NAME;
  doc.head.appendChild(meta);
  return meta;
}

export function readDocumentThemeColor(
  doc: Document | null | undefined = globalThis.document,
  windowLike: ThemeWindowLike | null | undefined = globalThis.window,
): string | null {
  if (!doc?.documentElement || !windowLike?.getComputedStyle) {
    return null;
  }

  const color = windowLike
    .getComputedStyle(doc.documentElement)
    .getPropertyValue(BROWSER_CHROME_COLOR_TOKEN);
  const normalizedColor = color.trim();
  return normalizedColor.length > 0 ? normalizedColor : null;
}

export function syncDocumentThemeColor(
  doc: Document | null | undefined = globalThis.document,
  windowLike: ThemeWindowLike | null | undefined = globalThis.window,
): void {
  if (!doc) {
    return;
  }

  const meta = ensureThemeColorMeta(doc);
  const color = readDocumentThemeColor(doc, windowLike);
  if (!meta || !color) {
    return;
  }

  meta.content = color;
}

export function buildThemeInitScript(): string {
  const storageKey = JSON.stringify(THEME_STORAGE_KEY);
  const themeColorMetaName = JSON.stringify(THEME_COLOR_META_NAME);
  const browserChromeColorToken = JSON.stringify(BROWSER_CHROME_COLOR_TOKEN);

  return `(function(){var theme='light';try{var stored=window.localStorage?window.localStorage.getItem(${storageKey}):null;if(stored==='light'||stored==='dark'){theme=stored;}else{var media=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;theme=media&&media.matches?'dark':'light';}}catch(error){var fallbackMedia=window.matchMedia?window.matchMedia('(prefers-color-scheme: dark)'):null;theme=fallbackMedia&&fallbackMedia.matches?'dark':'light';}document.documentElement.classList.remove('light','dark');document.documentElement.classList.add(theme);try{var applyThemeColor=function(){var meta=document.querySelector('meta[name='+${themeColorMetaName}+']');if(!meta&&document.head){meta=document.createElement('meta');meta.setAttribute('name',${themeColorMetaName});document.head.appendChild(meta);}var color=window.getComputedStyle?window.getComputedStyle(document.documentElement).getPropertyValue(${browserChromeColorToken}).trim():'';if(meta&&color){meta.setAttribute('content',color);}};applyThemeColor();if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyThemeColor,{once:true});}if(window.requestAnimationFrame){window.requestAnimationFrame(applyThemeColor);}}catch(error){}}());`;
}
