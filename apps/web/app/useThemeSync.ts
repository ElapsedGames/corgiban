import { useEffect } from 'react';
import { useSelector } from 'react-redux';

import type { RootState } from './state';

/**
 * Syncs `settings.theme` from the Redux store to the root HTML element's
 * class name so that CSS `.dark` / `.light` token overrides take effect.
 *
 * Must be called from a component that is already wrapped in a Redux
 * `<Provider>`.  The SSR-rendered document starts with `className="light"`
 * (matching the `settingsSlice` default), so no hydration mismatch occurs
 * on the first paint.
 */
export function useThemeSync(): void {
  const theme = useSelector((state: RootState) => state.settings.theme);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(theme);
  }, [theme]);
}
