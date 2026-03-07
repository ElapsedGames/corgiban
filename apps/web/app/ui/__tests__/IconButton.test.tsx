import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { IconButton } from '../IconButton';

describe('IconButton', () => {
  it('renders a button element with the given aria-label', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<span aria-hidden="true">+</span>} label="Add item" />,
    );

    expect(html).toContain('<button');
    expect(html).toContain('aria-label="Add item"');
  });

  it('sets type="button" by default', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<span aria-hidden="true">x</span>} label="Close" />,
    );

    expect(html).toContain('type="button"');
  });

  it('renders the icon as child content', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<span aria-hidden="true">+</span>} label="Add item" />,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('+');
  });

  it('applies ghost variant and sm size by default', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<span aria-hidden="true">x</span>} label="Close" />,
    );

    // ghost variant uses transparent bg; sm size uses px-3 py-1.5
    expect(html).toContain('bg-transparent');
    expect(html).toContain('px-3');
  });

  it('accepts a custom label for different icon buttons', () => {
    const html = renderToStaticMarkup(
      <IconButton icon={<span aria-hidden="true">i</span>} label="More information" />,
    );

    expect(html).toContain('aria-label="More information"');
  });
});
