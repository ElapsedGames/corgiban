export type BrowserStorageName = 'localStorage' | 'sessionStorage';

export function getBrowserStorage(storageName: BrowserStorageName): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[storageName];
  } catch {
    return null;
  }
}

export function getBrowserLocalStorage(): Storage | null {
  return getBrowserStorage('localStorage');
}

export function getBrowserSessionStorage(): Storage | null {
  return getBrowserStorage('sessionStorage');
}
