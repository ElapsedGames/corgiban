// @vitest-environment jsdom

import { act } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appNavProps: null as null | {
    boardSkinId: 'classic' | 'legacy';
    isBoardSkinReady: boolean;
    isThemeReady: boolean;
    onToggleBoardSkin: () => void;
    onToggleTheme: () => void;
    theme: 'light' | 'dark';
  },
  boardSkinState: {
    boardSkinId: 'classic' as 'classic' | 'legacy',
    isBoardSkinReady: true,
  },
  isRouteErrorResponse: vi.fn(),
  themeState: {
    isThemeReady: true,
    theme: 'light' as 'light' | 'dark',
  },
  toggleBoardSkin: vi.fn(),
  toggleTheme: vi.fn(),
  useRouteError: vi.fn(),
}));

vi.mock('../theme/theme', () => ({
  buildThemeInitScript: () => 'window.__themeInit = true;',
  syncDocumentThemeColor: vi.fn(),
  THEME_COLOR_META_NAME: 'theme-color',
}));

vi.mock('../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    isThemeReady: mocks.themeState.isThemeReady,
    theme: mocks.themeState.theme,
    toggleTheme: mocks.toggleTheme,
  }),
}));

vi.mock('../canvas/useAppBoardSkin', () => ({
  BoardSkinPreferenceProvider: ({ children }: { children: React.ReactNode }) => children,
  useAppBoardSkin: () => ({
    boardSkinId: mocks.boardSkinState.boardSkinId,
    isBoardSkinReady: mocks.boardSkinState.isBoardSkinReady,
    toggleBoardSkin: mocks.toggleBoardSkin,
  }),
}));

vi.mock('../ui/AppNav', () => ({
  AppNav: (props: {
    boardSkinId: 'classic' | 'legacy';
    isBoardSkinReady: boolean;
    isThemeReady: boolean;
    onToggleBoardSkin: () => void;
    onToggleTheme: () => void;
    theme: 'light' | 'dark';
  }) => {
    mocks.appNavProps = props;
    return <div data-testid="app-nav-stub">App nav stub</div>;
  },
}));

vi.mock('@remix-run/react', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  Links: () => (
    <>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="manifest" href="/manifest.webmanifest" />
    </>
  ),
  Meta: () => <meta name="mock-meta" content="ok" />,
  Outlet: () => <main id="main-content">Outlet content</main>,
  Scripts: () => <script data-testid="scripts-stub" />,
  ScrollRestoration: () => <div data-testid="scroll-restoration-stub" />,
  isRouteErrorResponse: mocks.isRouteErrorResponse,
  useRouteError: mocks.useRouteError,
}));

import App, { ErrorBoundary } from '../root';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

async function hydrateDocumentApp() {
  const markup = renderToString(<App />);
  document.open();
  document.write(`<!DOCTYPE html>${markup}`);
  document.close();

  let root: Root | undefined;
  await act(async () => {
    root = hydrateRoot(document, <App />);
  });

  if (!root) {
    throw new Error('Failed to hydrate root app.');
  }

  mountedRoots.push(root);
}

describe('root app shell', () => {
  beforeEach(() => {
    mocks.appNavProps = null;
    mocks.boardSkinState.boardSkinId = 'classic';
    mocks.boardSkinState.isBoardSkinReady = true;
    mocks.isRouteErrorResponse.mockReset();
    mocks.themeState.isThemeReady = true;
    mocks.themeState.theme = 'light';
    mocks.toggleBoardSkin.mockReset();
    mocks.toggleTheme.mockReset();
    mocks.useRouteError.mockReset();
    document.open();
    document.write('<!DOCTYPE html><html><head></head><body></body></html>');
    document.close();
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('renders the document shell, outlet content, and root theme props', () => {
    mocks.boardSkinState.boardSkinId = 'legacy';
    mocks.boardSkinState.isBoardSkinReady = false;
    mocks.themeState.isThemeReady = false;
    mocks.themeState.theme = 'dark';

    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('window.__themeInit = true;');
    expect(html).toContain('<meta name="theme-color" content=""/>');
    expect(html).toContain('Skip to main content');
    expect(html).toContain('Outlet content');
    expect(html).toContain('App nav stub');
    expect(html).toContain('data-testid="scroll-restoration-stub"');
    expect(html).toContain('data-testid="scripts-stub"');
    expect(mocks.appNavProps).toMatchObject({
      boardSkinId: 'legacy',
      isBoardSkinReady: false,
      isThemeReady: false,
      onToggleBoardSkin: mocks.toggleBoardSkin,
      onToggleTheme: mocks.toggleTheme,
      theme: 'dark',
    });
  });

  it('updates the svg favicon when the hydrated theme is dark', async () => {
    mocks.themeState.theme = 'dark';

    await hydrateDocumentApp();

    expect(
      document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href'),
    ).toBe('/favicon-dark.svg');
  });

  it('keeps the light svg favicon when the hydrated theme is light', async () => {
    mocks.themeState.theme = 'light';

    await hydrateDocumentApp();

    expect(
      document.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute('href'),
    ).toBe('/favicon.svg');
  });

  it('hydrates cleanly when the inline theme bootstrap mutates theme-color before React attaches', async () => {
    const markup = renderToString(<App />);
    document.open();
    document.write(`<!DOCTYPE html>${markup}`);
    document.close();

    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0b1120');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let root: Root | undefined;
      await act(async () => {
        root = hydrateRoot(document, <App />);
      });

      if (!root) {
        throw new Error('Failed to hydrate root app.');
      }

      mountedRoots.push(root);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});

describe('root ErrorBoundary', () => {
  beforeEach(() => {
    mocks.appNavProps = null;
    mocks.boardSkinState.boardSkinId = 'classic';
    mocks.boardSkinState.isBoardSkinReady = true;
    mocks.isRouteErrorResponse.mockReset();
    mocks.themeState.isThemeReady = true;
    mocks.themeState.theme = 'light';
    mocks.toggleBoardSkin.mockReset();
    mocks.toggleTheme.mockReset();
    mocks.useRouteError.mockReset();
  });

  it('renders route error responses with status text and recovery navigation', () => {
    mocks.useRouteError.mockReturnValue({ status: 404, statusText: 'Not Found' });
    mocks.isRouteErrorResponse.mockReturnValue(true);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('<title>Error | Corgiban</title>');
    expect(html).toContain('Error 404');
    expect(html).toContain('Not Found');
    expect(html).toContain('href="/"');
    expect(html).toContain('Return to a working page and try again.');
  });

  it('falls back to an HTTP status message when route status text is missing', () => {
    mocks.useRouteError.mockReturnValue({ status: 503, statusText: '' });
    mocks.isRouteErrorResponse.mockReturnValue(true);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Error 503');
    expect(html).toContain('HTTP 503');
  });

  it('renders thrown Error messages verbatim', () => {
    mocks.useRouteError.mockReturnValue(new Error('route shell failed'));
    mocks.isRouteErrorResponse.mockReturnValue(false);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Something went wrong');
    expect(html).toContain('route shell failed');
  });

  it('renders the generic fallback for non-Error throw values', () => {
    mocks.useRouteError.mockReturnValue({ unexpected: true });
    mocks.isRouteErrorResponse.mockReturnValue(false);

    const html = renderToStaticMarkup(<ErrorBoundary />);

    expect(html).toContain('Something went wrong');
    expect(html).toContain('An unexpected error occurred.');
  });
});
