import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

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

  it('renders the landing-page hero copy', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('Corgiban');
    expect(html).toContain('Deterministic Sokoban play');
  });

  it('renders entry points for the main workflows', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('href="/play"');
    expect(html).toContain('href="/bench"');
    expect(html).toContain('href="/lab"');
    expect(html).not.toContain('href="/dev/ui-kit"');
  });

  it('renders the shared package version', () => {
    const html = renderToStaticMarkup(<IndexRoute />);

    expect(html).toContain('aria-label="Main workflows"');
    expect(html).toContain('Shared package version:');
    expect(html).toContain('0.0.0');
  });
});
