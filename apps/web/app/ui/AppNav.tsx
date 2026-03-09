import { NavLink } from '@remix-run/react';

import type { AppTheme } from '../theme/theme';

type AppNavProps = {
  isThemeReady: boolean;
  onToggleTheme: () => void;
  theme: AppTheme;
};

const navLinks = [
  { end: false, label: 'Play', to: '/play' },
  { end: false, label: 'Benchmark', to: '/bench' },
  { end: false, label: 'Lab', to: '/lab' },
  { end: false, label: 'UI Kit', to: '/dev/ui-kit' },
] as const;

function getNavLinkClassName(isActive: boolean): string {
  return `app-nav__link${isActive ? ' app-nav__link--active' : ''}`;
}

function formatThemeValue(theme: AppTheme): string {
  return theme === 'dark' ? 'Dark' : 'Light';
}

export function AppNav({ isThemeReady, onToggleTheme, theme }: AppNavProps) {
  return (
    <header className="app-nav">
      <div className="app-nav__inner">
        <div className="app-nav__cluster">
          <NavLink className="app-nav__brand" end to="/">
            Corgiban
          </NavLink>
          <nav aria-label="Primary" className="app-nav__links">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                className={({ isActive }) => getNavLinkClassName(isActive)}
                end={link.end}
                to={link.to}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <button
          aria-label="Toggle color theme"
          aria-pressed={isThemeReady ? theme === 'dark' : undefined}
          className="app-nav__theme-toggle"
          disabled={!isThemeReady}
          onClick={onToggleTheme}
          type="button"
        >
          <span className="app-nav__theme-label">Theme</span>
          <span className="app-nav__theme-value">
            {isThemeReady ? formatThemeValue(theme) : 'Syncing'}
          </span>
        </button>
      </div>
    </header>
  );
}
