import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const activeHref = '/play';

vi.mock('@remix-run/react', () => ({
  NavLink: ({
    children,
    className,
    end,
    to,
    ...props
  }: {
    children: ReactNode;
    className?: string | ((args: { isActive: boolean }) => string);
    end?: boolean;
    to: string;
    [key: string]: unknown;
  }) => {
    const isActive = end ? to === activeHref : activeHref === to;
    const resolvedClassName =
      typeof className === 'function' ? className({ isActive }) : (className ?? undefined);

    return (
      <a
        aria-current={isActive ? 'page' : undefined}
        className={resolvedClassName}
        href={to}
        {...props}
      >
        {children}
      </a>
    );
  },
}));

import { AppNav } from '../AppNav';

describe('AppNav', () => {
  it('renders the expected route links', () => {
    const html = renderToStaticMarkup(
      <AppNav isThemeReady onToggleTheme={() => undefined} theme="light" />,
    );

    expect(html).toContain('href="/"');
    expect(html).toContain('href="/play"');
    expect(html).toContain('href="/bench"');
    expect(html).toContain('href="/lab"');
    expect(html).not.toContain('href="/dev/ui-kit"');
    expect(html).toContain('Light');
  });

  it('marks the active route with the active nav class and aria-current', () => {
    const html = renderToStaticMarkup(
      <AppNav isThemeReady onToggleTheme={() => undefined} theme="dark" />,
    );

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('app-nav__link app-nav__link--active');
    expect(html).toContain('Dark');
  });

  it('shows a syncing state until the theme is ready', () => {
    const html = renderToStaticMarkup(
      <AppNav isThemeReady={false} onToggleTheme={() => undefined} theme="light" />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Syncing');
  });
});
