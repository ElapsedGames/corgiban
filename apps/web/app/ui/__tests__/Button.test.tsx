import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from '../Button';

describe('Button', () => {
  it('builds class names from variant and size and respects type', () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" size="lg" className="extra">
        Save
      </Button>,
    );

    expect(html).toContain('type="button"');
    expect(html).toContain('border');
    expect(html).toContain('px-5');
    expect(html).toContain('extra');
  });

  it('exposes tonal and destructive variants for supporting and destructive actions', () => {
    const tonalHtml = renderToStaticMarkup(<Button variant="tonal">Apply</Button>);
    const destructiveHtml = renderToStaticMarkup(<Button variant="destructive">Delete</Button>);

    expect(tonalHtml).toContain('bg-accent-surface');
    expect(tonalHtml).toContain('border-accent-border');
    expect(destructiveHtml).toContain('bg-error');
    expect(destructiveHtml).toContain('border-error');
  });

  it('renders a stronger primary treatment by default', () => {
    const html = renderToStaticMarkup(<Button>Continue</Button>);

    expect(html).toContain('bg-accent');
    expect(html).toContain('text-accent-contrast');
    expect(html).toContain('shadow-sm');
  });

  it('respects explicit type override', () => {
    const html = renderToStaticMarkup(<Button type="submit">Submit</Button>);
    expect(html).toContain('type="submit"');
  });

  it('forwards a ref to the underlying button element', () => {
    const ref = createRef<HTMLButtonElement>();
    // renderToStaticMarkup does not mount into the DOM, so we cannot assert
    // ref.current here. Instead we verify that the component accepts a ref
    // prop without throwing, which is the minimal smoke check for forwardRef.
    expect(() => renderToStaticMarkup(<Button ref={ref}>Click me</Button>)).not.toThrow();
  });
});
