// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('AppNav', () => {
  afterEach(() => {
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
      <AppNav isThemeReady onToggleTheme={() => undefined} theme="light" />,
    );

    expect(html).toContain('href="/play"');
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

  it('shows the tri-color corgi in dark mode and the standard corgi in light mode', () => {
    const lightHtml = renderToStaticMarkup(
      <AppNav isThemeReady onToggleTheme={() => undefined} theme="light" />,
    );
    const darkHtml = renderToStaticMarkup(
      <AppNav isThemeReady onToggleTheme={() => undefined} theme="dark" />,
    );

    expect(lightHtml).toContain('src="/favicon.svg"');
    expect(darkHtml).toContain('src="/favicon-dark.svg"');
  });

  it('shows a syncing state until the theme is ready', () => {
    const html = renderToStaticMarkup(
      <AppNav isThemeReady={false} onToggleTheme={() => undefined} theme="light" />,
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain('Syncing');
  });

  it('toggles the theme immediately after a mouse click', () => {
    const onToggleTheme = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav isThemeReady onToggleTheme={onToggleTheme} theme="light" />,
    );
    const button = getThemeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    });

    expect(onToggleTheme).toHaveBeenCalledOnce();
  });

  it('treats a double click as two normal theme toggles with no hidden behavior', () => {
    const onToggleTheme = vi.fn();
    const { container } = renderIntoDocument(
      <AppNav isThemeReady onToggleTheme={onToggleTheme} theme="light" />,
    );
    const button = getThemeToggleButton(container);

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }));
      button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    });

    expect(onToggleTheme).toHaveBeenCalledTimes(2);
  });
});
