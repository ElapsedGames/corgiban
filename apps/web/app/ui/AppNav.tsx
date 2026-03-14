import type { BoardSkinId } from '../canvas/boardSkin';
import { NavLink, useLocation } from '@remix-run/react';

import type { AppTheme } from '../theme/theme';

type AppNavProps = {
  boardSkinId: BoardSkinId;
  isBoardSkinReady: boolean;
  isThemeReady: boolean;
  onToggleBoardSkin: () => void;
  onToggleTheme: () => void;
  theme: AppTheme;
};

const navLinks = [
  { end: false, label: 'Play', to: '/play' },
  { end: false, label: 'Benchmark', to: '/bench' },
  { end: false, label: 'Lab', to: '/lab' },
] as const;

function getNavLinkClassName(isActive: boolean): string {
  return `app-nav__link${isActive ? ' app-nav__link--active' : ''}`;
}

function formatThemeValue(theme: AppTheme): string {
  return theme === 'dark' ? 'Dark' : 'Light';
}

function formatBoardSkinValue(boardSkinId: BoardSkinId): string {
  return boardSkinId === 'classic' ? 'Corg' : 'Lame';
}

export function AppNav({
  boardSkinId,
  isBoardSkinReady,
  isThemeReady,
  onToggleBoardSkin,
  onToggleTheme,
  theme,
}: AppNavProps) {
  const location = useLocation();
  const showBoardModeToggle =
    location.pathname === '/play' || location.pathname === '/lab' || location.pathname === '/';

  const handleToggleBoardSkin = () => {
    if (!isBoardSkinReady) {
      return;
    }

    onToggleBoardSkin();
  };

  const handleToggleTheme = () => {
    if (!isThemeReady) {
      return;
    }

    onToggleTheme();
  };

  return (
    <header className="app-nav">
      <div className="app-nav__inner">
        <div className="app-nav__cluster">
          <NavLink className="app-nav__brand" end to="/play">
            <img
              src={theme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg'}
              alt=""
              aria-hidden="true"
              className="app-nav__brand-icon"
            />
            Corgiban
            <span className="app-nav__alpha-badge">Alpha</span>
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
          <div className="app-nav__toggles">
            {showBoardModeToggle ? (
              <button
                aria-label="Toggle board mode"
                aria-disabled={!isBoardSkinReady}
                aria-pressed={isBoardSkinReady ? boardSkinId === 'classic' : undefined}
                className="app-nav__toggle"
                onClick={handleToggleBoardSkin}
                type="button"
              >
                <span className="app-nav__toggle-label">Mode</span>
                <span className="app-nav__toggle-value">
                  {isBoardSkinReady ? formatBoardSkinValue(boardSkinId) : 'Syncing'}
                </span>
              </button>
            ) : null}
            <button
              aria-label="Toggle color theme"
              aria-disabled={!isThemeReady}
              aria-pressed={isThemeReady ? theme === 'dark' : undefined}
              className="app-nav__toggle"
              onClick={handleToggleTheme}
              type="button"
            >
              <span className="app-nav__toggle-label">Theme</span>
              <span className="app-nav__toggle-value">
                {isThemeReady ? formatThemeValue(theme) : 'Syncing'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
