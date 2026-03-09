import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';
import type { ReactNode } from 'react';

vi.mock('@remix-run/react', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: ReactNode;
    to: string;
    [key: string]: unknown;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/unknown-path' }),
}));

import NotFoundRoute, { loader } from '../$';

describe('NotFoundRoute', () => {
  it('renders a 404 page with a link to play', () => {
    const html = renderToStaticMarkup(<NotFoundRoute />);

    expect(html).toContain('404 Not Found');
    expect(html).toContain('href="/play"');
    expect(html).toContain('Play');
  });

  it('displays the requested pathname in the error subtitle', () => {
    const html = renderToStaticMarkup(<NotFoundRoute />);

    // useLocation is mocked to return { pathname: '/unknown-path' }
    expect(html).toContain('/unknown-path');
  });

  it('renders a Home link so users can recover without typing a URL', () => {
    const html = renderToStaticMarkup(<NotFoundRoute />);

    expect(html).toContain('href="/"');
    expect(html).toContain('Home');
  });

  it('renders a main landmark with id="main-content"', () => {
    const html = renderToStaticMarkup(<NotFoundRoute />);

    expect(html).toContain('id="main-content"');
  });

  it('applies break-all to the pathname code element to prevent layout overflow on long URLs', () => {
    const html = renderToStaticMarkup(<NotFoundRoute />);

    // The <code> element wrapping the pathname must carry break-all so that
    // very long pathnames (e.g. 500-char slugs) cannot overflow the container.
    expect(html).toContain('break-all');
  });

  it('returns an HTTP 404 status', async () => {
    const response = await loader({
      request: new Request('http://localhost/unknown/path'),
      params: {},
      context: {},
    });

    expect(response.status).toBe(404);
  });
});
