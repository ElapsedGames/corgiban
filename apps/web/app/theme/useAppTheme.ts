import { useCallback, useEffect, useState } from 'react';

import { getBrowserLocalStorage } from '../browserStorage';
import { getDocumentTheme, persistTheme, setDocumentTheme, type AppTheme } from './theme';

export type UseAppThemeResult = {
  isThemeReady: boolean;
  theme: AppTheme;
  toggleTheme: () => void;
};

export function useAppTheme(): UseAppThemeResult {
  const [theme, setTheme] = useState<AppTheme>('light');
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    setTheme(getDocumentTheme());
    setIsThemeReady(true);
  }, []);

  const applyTheme = useCallback((nextTheme: AppTheme) => {
    setDocumentTheme(nextTheme);
    persistTheme(nextTheme, getBrowserLocalStorage());
    setTheme(nextTheme);
    setIsThemeReady(true);
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [applyTheme, theme]);

  return {
    isThemeReady,
    theme,
    toggleTheme,
  };
}
