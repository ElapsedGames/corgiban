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
}));

import NotFoundRoute, { loader } from '../$';

describe('NotFoundRoute', () => {
  it('renders a 404 page with a link to play', () => {
    const html = renderToStaticMarkup(<NotFoundRoute />);

    expect(html).toContain('404 Not Found');
    expect(html).toContain('Go to /play');
    expect(html).toContain('href="/play"');
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
