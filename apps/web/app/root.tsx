import type { LinksFunction, MetaFunction } from '@remix-run/node';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import appStylesHref from './styles/app.css?url';
import tokensHref from './styles/tokens.css?url';

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

export default function App() {
  return (
    <html lang="en" className="light">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
