// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { Input } from '../Input';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

describe('Input', () => {
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

  it('renders an info tooltip button beside the label when annotation text is provided', () => {
    const html = renderToStaticMarkup(
      <Input
        id="budget-input"
        label="Time Budget"
        annotation="This is the time limit for each run."
        placeholder="1000"
      />,
    );

    expect(html).toContain('Time Budget');
    expect(html).toContain('Time Budget help');
    expect(html).toContain('role="tooltip"');
    expect(html).toContain('This is the time limit for each run.');
    expect(html).toContain('id="budget-input-annotation"');
    expect(html).toContain('aria-describedby="budget-input-annotation"');
  });

  it('prevents default on annotation-button clicks so parent forms do not submit', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push(root);

    act(() => {
      root.render(
        <Input id="budget-input" label="Time Budget" annotation="Help text" placeholder="1000" />,
      );
    });

    const button = container.querySelector('button[aria-label="Time Budget help"]');
    expect(button).toBeInstanceOf(HTMLButtonElement);

    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    button?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
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
