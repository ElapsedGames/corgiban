import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Input } from '../Input';

describe('Input', () => {
  it('wires label and hint metadata to accessibility attributes', () => {
    const html = renderToStaticMarkup(
      <Input id="budget-input" label="Time Budget" hint="Milliseconds" placeholder="1000" />,
    );

    expect(html).toContain('<label');
    expect(html).toContain('for="budget-input"');
    expect(html).toContain('id="budget-input"');
    expect(html).toContain('aria-describedby="budget-input-hint"');
    expect(html).toContain('Milliseconds');
  });

  it('prefers error metadata over hint and marks input invalid', () => {
    const html = renderToStaticMarkup(
      <Input
        id="budget-input"
        hint="This should be hidden when error is shown."
        error="Budget is required."
        className="custom-field"
      />,
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="budget-input-error"');
    expect(html).toContain('border-error');
    expect(html).toContain('text-error-text');
    expect(html).toContain('custom-field');
    expect(html).toContain('Budget is required.');
    expect(html).not.toContain('This should be hidden when error is shown.');
  });

  it('generates an id when omitted and renders without hint/error metadata', () => {
    const html = renderToStaticMarkup(<Input />);

    expect(html).toMatch(/id="[^"]+"/);
    expect(html).not.toContain('aria-describedby=');
    expect(html).not.toContain('aria-invalid=');
  });
});
