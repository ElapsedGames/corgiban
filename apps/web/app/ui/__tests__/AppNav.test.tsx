// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let activeHref = '/play';

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
  useLocation: () => ({
    pathname: activeHref,
  }),
}));

import { AppNav } from '../AppNav';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

function renderIntoDocument(element: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  act(() => {
    root.render(element);
  });

  return { container };
}

function getThemeToggleButton(container: HTMLElement) {
  const button = container.querySelector('button[aria-label="Toggle color theme"]');
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

function getBoardModeToggleButton(container: HTMLElement) {
  const button = container.querySelector('button[aria-label="Toggle board mode"]');
  expect(button).toBeInstanceOf(HTMLButtonElement);
  return button as HTMLButtonElement;
}

describe('AppNav', () => {
  afterEach(() => {
    activeHref = '/play';
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      act(() => {
        root?.unmount();
      });
    }

    document.body.innerHTML = '';
  });

  it('renders the expected route links', () => {
    const html = renderToStaticMarkup(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );

    expect(html).toContain('href="/play"');
    expect(html).toContain('href="/play"');
    expect(html).toContain('href="/bench"');
    expect(html).toContain('href="/lab"');
    expect(html).not.toContain('href="/dev/ui-kit"');
    expect(html).toContain('Corg');
    expect(html).toContain('Light');
  });

  it('marks the active route with the active nav class and aria-current', () => {
    const html = renderToStaticMarkup(
      <AppNav
        boardSkinId="legacy"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="dark"
      />,
    );

    expect(html).toContain('aria-current="page"');
    expect(html).toContain('app-nav__link app-nav__link--active');
    expect(html).toContain('Lame');
    expect(html).toContain('Dark');
  });

  it('shows the tri-color corgi in dark mode and the standard corgi in light mode', () => {
    const lightHtml = renderToStaticMarkup(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );
    const darkHtml = renderToStaticMarkup(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="dark"
      />,
    );

    expect(lightHtml).toContain('src="/favicon.svg"');
    expect(darkHtml).toContain('src="/favicon-dark.svg"');
  });

  it('shows a syncing state until the theme is ready', () => {
    const html = renderToStaticMarkup(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady={false}
        isThemeReady={false}
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );

    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2);
    expect(html).toContain('Syncing');
  });

  it('does not toggle the board mode while syncing', () => {
    const onToggleBoardSkin = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady={false}
        isThemeReady
        onToggleBoardSkin={onToggleBoardSkin}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );
    const button = getBoardModeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });

    expect(onToggleBoardSkin).not.toHaveBeenCalled();
  });

  it('does not toggle the theme while syncing', () => {
    const onToggleTheme = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady={false}
        onToggleBoardSkin={() => undefined}
        onToggleTheme={onToggleTheme}
        theme="light"
      />,
    );
    const button = getThemeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });

    expect(onToggleTheme).not.toHaveBeenCalled();
  });

  it('toggles the theme immediately after a mouse click', () => {
    const onToggleTheme = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={onToggleTheme}
        theme="light"
      />,
    );
    const button = getThemeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });

    expect(onToggleTheme).toHaveBeenCalledOnce();
  });

  it('toggles the board mode immediately after a mouse click', () => {
    const onToggleBoardSkin = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={onToggleBoardSkin}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );
    const button = getBoardModeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });

    expect(onToggleBoardSkin).toHaveBeenCalledOnce();
  });

  it('treats a double click as two normal theme toggles with no hidden behavior', () => {
    const onToggleTheme = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={onToggleTheme}
        theme="light"
      />,
    );
    const button = getThemeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
      button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    });

    expect(onToggleTheme).toHaveBeenCalledTimes(2);
  });

  it('shows the board mode toggle on the Lab route too', () => {
    activeHref = '/lab';

    const html = renderToStaticMarkup(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );

    expect(html).toContain('Toggle board mode');
    expect(html).toContain('<span class="app-nav__toggle-value">Corg</span>');
  });

  it('hides the board mode toggle outside the Play and Lab routes', () => {
    activeHref = '/bench';

    const html = renderToStaticMarkup(
      <AppNav
        boardSkinId="classic"
        isBoardSkinReady
        isThemeReady
        onToggleBoardSkin={() => undefined}
        onToggleTheme={() => undefined}
        theme="light"
      />,
    );

    expect(html).not.toContain('Toggle board mode');
    expect(html).not.toContain('<span class="app-nav__toggle-value">Corg</span>');
    expect(html).toContain('Toggle color theme');
  });
});
