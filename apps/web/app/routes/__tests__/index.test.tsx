import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
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

vi.mock('@corgiban/shared', () => ({
  sharedVersion: '0.0.0',
}));

import IndexRoute from '../_index';

describe('IndexRoute', () => {
  it('renders a main landmark with id="main-content"', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('id="main-content"');
  });

  it('renders the page heading', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('Corgiban');
  });

  it('links to the Play, Benchmark, Lab, and UI Kit routes', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('href="/play"');
    expect(html).toContain('href="/bench"');
    expect(html).toContain('href="/lab"');
    expect(html).toContain('href="/dev/ui-kit"');
  });

  it('renders the shared package version', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('0.0.0');
  });
});
