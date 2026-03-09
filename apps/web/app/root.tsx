import type { LinksFunction, MetaFunction } from '@remix-run/node';
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

import appStylesHref from './styles/app.css?url';
import tokensHref from './styles/tokens.css?url';
import { buildThemeInitScript } from './theme/theme';
import { useAppTheme } from './theme/useAppTheme';
import { AppNav } from './ui/AppNav';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: tokensHref },
  { rel: 'stylesheet', href: appStylesHref },
  { rel: 'manifest', href: '/manifest.webmanifest' },
  { rel: 'icon', href: '/favicon.ico', type: 'image/x-icon' },
];

export const meta: MetaFunction = () => [
  { title: 'Corgiban' },
  { name: 'viewport', content: 'width=device-width, initial-scale=1' },
  { name: 'theme-color', content: '#0d1218' },
];

const themeInitScript = buildThemeInitScript();

type DocumentProps = {
  children: ReactNode;
  title?: string;
};

function Document({ children, title }: DocumentProps) {
  const { isThemeReady, theme, toggleTheme } = useAppTheme();

  return (
    <html className="light" lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        {title ? <title>{title}</title> : null}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Meta />
        <Links />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-[var(--radius-md)] focus-visible:bg-[color:var(--color-panel)] focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-[color:var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)]"
        >
          Skip to main content
        </a>
        <AppNav isThemeReady={isThemeReady} onToggleTheme={toggleTheme} theme={theme} />
        {children}
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
          <p className="text-sm text-[color:var(--color-muted)]">
            Return to a working page and try again.
          </p>
          <nav aria-label="Recovery links" className="mt-4 flex flex-wrap gap-3 text-sm">
            <Link
              className="rounded px-2 py-1 font-semibold text-[color:var(--color-accent)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-bg)]"
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
