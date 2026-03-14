// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Select } from '../Select';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe('Select', () => {
  const mountedRoots: Root[] = [];

  afterEach(() => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      act(() => {
        root?.unmount();
      });
    }
    document.body.innerHTML = '';
  });

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

  it('renders an info tooltip button beside the label when annotation text is provided', () => {
    const html = renderToStaticMarkup(
      <Select id="format-select" label="Input format" annotation="Pick the format your text uses.">
        <option value="corg">CORG</option>
      </Select>,
    );

    expect(html).toContain('Input format help');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('Pick the format your text uses.');
    expect(html).toContain('id="format-select-annotation"');
    expect(html).toContain('aria-describedby="format-select-annotation"');
  });

  it('prevents default on annotation-button clicks so parent forms do not submit', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        <Select id="format-select" label="Input format" annotation="Help text">
          <option value="corg">CORG</option>
        </Select>,
      );
    });

    const button = container.querySelector('button[aria-label="Input format help"]');
    expect(button).toBeInstanceOf(HTMLButtonElement);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
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
    expect(html).toContain('border-error');
    expect(html).toContain('text-error-text');
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
