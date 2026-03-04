import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Select } from '../Select';

describe('Select', () => {
  it('wires label and hint to select accessibility attributes', () => {
    const html = renderToStaticMarkup(
      <Select id="algorithm-select" label="Algorithm" hint="Choose one.">
        <option value="bfsPush">BFS</option>
      </Select>,
    );

    expect(html).toContain('<label');
    expect(html).toContain('for="algorithm-select"');
    expect(html).toContain('id="algorithm-select"');
    expect(html).toContain('aria-describedby="algorithm-select-hint"');
    expect(html).toContain('Choose one.');
  });

  it('prefers error metadata over hint and marks select invalid', () => {
    const html = renderToStaticMarkup(
      <Select
        id="algorithm-select"
        hint="Hint should be hidden when error is present."
        error="Algorithm is required."
        className="custom-class"
      >
        <option value="bfsPush">BFS</option>
      </Select>,
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="algorithm-select-error"');
    expect(html).toContain('border-red-400');
    expect(html).toContain('custom-class');
    expect(html).toContain('Algorithm is required.');
    expect(html).not.toContain('Hint should be hidden when error is present.');
  });

  it('renders without label/hint/error metadata and generates an id when omitted', () => {
    const html = renderToStaticMarkup(
      <Select>
        <option value="bfsPush">BFS</option>
      </Select>,
    );

    expect(html).not.toContain('<label');
    expect(html).toMatch(/id="[^"]+"/);
    expect(html).not.toContain('aria-describedby=');
    expect(html).not.toContain('aria-invalid=');
  });
});
