import type {
  LinksFunction,
  ServerRuntimeMetaFunction as MetaFunction,
} from '@remix-run/server-runtime';
import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
} from '@remix-run/react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { BoardSkinPreferenceProvider } from './canvas/useAppBoardSkin';
import appStylesHref from './styles/app.css?url';
import tokensHref from './styles/tokens.css?url';
import { buildThemeInitScript, syncDocumentThemeColor, THEME_COLOR_META_NAME } from './theme/theme';
import { useAppTheme } from './theme/useAppTheme';
import { useAppBoardSkin } from './canvas/useAppBoardSkin';
import { AppNav } from './ui/AppNav';

const SITE_URL = 'https://corgiban.elapsedgames.com';
const DEFAULT_TITLE = 'Corgiban';
const DEFAULT_DESCRIPTION = 'Deterministic Sokoban game, solver, and benchmark suite.';
const SOCIAL_IMAGE_URL = `${SITE_URL}/social-card.png`;
const SOCIAL_IMAGE_ALT = 'Corgiban preview card with the corgi icon and a Sokoban board.';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: tokensHref },
  { rel: 'stylesheet', href: appStylesHref },
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
  { rel: 'shortcut icon', href: '/favicon.ico' },
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
];

export const meta: MetaFunction = () => [
  { title: DEFAULT_TITLE },
  { name: 'description', content: DEFAULT_DESCRIPTION },
  { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: DEFAULT_TITLE },
  { property: 'og:title', content: DEFAULT_TITLE },
  { property: 'og:description', content: DEFAULT_DESCRIPTION },
  { property: 'og:url', content: `${SITE_URL}/play` },
  { property: 'og:image', content: SOCIAL_IMAGE_URL },
  { property: 'og:image:alt', content: SOCIAL_IMAGE_ALT },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:title', content: DEFAULT_TITLE },
  { name: 'twitter:description', content: DEFAULT_DESCRIPTION },
  { name: 'twitter:image', content: SOCIAL_IMAGE_URL },
  { name: 'twitter:image:alt', content: SOCIAL_IMAGE_ALT },
];

const themeInitScript = buildThemeInitScript();

type DocumentProps = {
  children: ReactNode;
  title?: string;
};

function useFaviconTheme(theme: 'light' | 'dark') {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]');
    if (link) {
      link.href = theme === 'dark' ? '/favicon-dark.svg' : '/favicon.svg';
    }
  }, [theme]);
}

function useThemeColorMeta(theme: 'light' | 'dark') {
  useEffect(() => {
    syncDocumentThemeColor();
  }, [theme]);
}

function Document({ children, title }: DocumentProps) {
  const { boardSkinId, isBoardSkinReady, toggleBoardSkin } = useAppBoardSkin();
  const { isThemeReady, theme, toggleTheme } = useAppTheme();
  useFaviconTheme(theme);
  useThemeColorMeta(theme);

  return (
    <html className="light" lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {title ? <title>{title}</title> : null}
        <Meta />
        <meta name={THEME_COLOR_META_NAME} content="" suppressHydrationWarning />
        <Links />
        {/* eslint-disable-next-line no-restricted-syntax -- theme init script is built from constants, not user input */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-app-md focus-visible:bg-panel focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Skip to main content
        </a>
        <AppNav
          boardSkinId={boardSkinId}
          isBoardSkinReady={isBoardSkinReady}
          isThemeReady={isThemeReady}
          onToggleBoardSkin={toggleBoardSkin}
          onToggleTheme={toggleTheme}
          theme={theme}
        />
        <BoardSkinPreferenceProvider boardSkinId={boardSkinId}>
          {children}
        </BoardSkinPreferenceProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const isHttp = isRouteErrorResponse(error);
  const heading = isHttp ? `Error ${error.status}` : 'Something went wrong';
  const message = isHttp
    ? error.statusText || `HTTP ${error.status}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.';

  return (
    <Document title="Error | Corgiban">
      <main id="main-content" className="page-shell">
        <h1 className="page-title">{heading}</h1>
        <p className="page-subtitle">{message}</p>
        <section className="route-card" aria-label="Recovery navigation">
          <p className="text-sm text-muted">Return to a working page and try again.</p>
          <nav aria-label="Recovery links" className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              className="rounded px-2 py-1 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              to="/"
            >
              Home
            </Link>
          </nav>
        </section>
      </main>
    </Document>
  );
}
