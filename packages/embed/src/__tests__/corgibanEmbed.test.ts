import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EMBED_ELEMENT_TAG, defineCorgibanEmbed } from '../corgibanEmbed';

async function commitDomUpdate(action: () => void): Promise<void> {
  await act(async () => {
    action();
  });
}

function buttonByLabel(element: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    [...(element.shadowRoot?.querySelectorAll('button') ?? [])].find(
      (button): button is HTMLButtonElement => button.textContent?.trim() === label,
    ) ?? null
  );
}

function shadowText(element: HTMLElement): string {
  return element.shadowRoot?.textContent ?? '';
}

describe('corgibanEmbed', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('mounts in shadow DOM and reacts to attribute changes', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-002');
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(element.shadowRoot).toBeTruthy();
    expect(shadowText(element)).toContain('Classic 2');

    await commitDomUpdate(() => {
      element.setAttribute('level-id', 'classic-003');
    });

    expect(shadowText(element)).toContain('Classic 3');
  });

  it('emits move and solved events', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute(
      'level-data',
      JSON.stringify({
        id: 'custom-level',
        name: 'Custom',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      }),
    );

    const moveHandler = vi.fn();
    const solvedHandler = vi.fn();
    element.addEventListener('corgiban:move', moveHandler);
    element.addEventListener('corgiban:solved', solvedHandler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    const rightButton = buttonByLabel(element, 'R');

    expect(rightButton).toBeTruthy();
    await commitDomUpdate(() => {
      rightButton?.click();
    });

    expect(moveHandler).toHaveBeenCalled();
    expect(solvedHandler).toHaveBeenCalled();
  });

  it('emits benchmarkComplete when show-solver is enabled', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-001');
    element.setAttribute('show-solver', '');

    const handler = vi.fn();
    element.addEventListener('corgiban:benchmarkComplete', handler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    const solveButton = buttonByLabel(element, 'Apply Known Solution');

    expect(solveButton).toBeTruthy();
    await commitDomUpdate(() => {
      solveButton?.click();
    });

    expect(handler).toHaveBeenCalled();
  });

  it('prefers a valid level-id over invalid level-data and does not emit an error', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-003');
    element.setAttribute(
      'level-data',
      JSON.stringify({
        id: 'broken-layout',
        name: 'Broken Layout',
        rows: ['WWWWW', 'WPPBW', 'WWWWW'],
      }),
    );

    const handler = vi.fn();
    element.addEventListener('corgiban:error', handler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(handler).not.toHaveBeenCalled();
    expect(shadowText(element)).toContain('Classic 3');
    expect(shadowText(element)).not.toContain('Embedded level unavailable');
  });

  it('emits a structured error and renders an invalid state for unknown built-in level ids', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-999');

    const handler = vi.fn();
    element.addEventListener('corgiban:error', handler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          code: 'invalid-level-id',
          levelId: 'classic-999',
          message: 'Unknown level-id "classic-999".',
        }),
      }),
    );
    expect(shadowText(element)).toContain('Embedded level unavailable');
    expect(shadowText(element)).toContain('Unknown level-id "classic-999".');
  });

  it('falls back to level-data when level-id is unknown', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-999');
    element.setAttribute(
      'level-data',
      JSON.stringify({
        id: 'custom-fallback',
        name: 'Custom Fallback',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      }),
    );

    const handler = vi.fn();
    element.addEventListener('corgiban:error', handler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(handler).not.toHaveBeenCalled();
    expect(shadowText(element)).toContain('Custom Fallback');
    expect(shadowText(element)).not.toContain('Embedded level unavailable');
  });

  it('emits a structured error when neither level-id nor level-data are provided', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);

    const handler = vi.fn();
    element.addEventListener('corgiban:error', handler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          code: 'invalid-level-data',
          levelId: null,
          message: 'Embed requires either a valid level-id or valid level-data.',
        }),
      }),
    );
    expect(shadowText(element)).toContain('Embedded level unavailable');
    expect(shadowText(element)).toContain(
      'Embed requires either a valid level-id or valid level-data.',
    );
  });

  it('preserves gameplay state when non-level attributes change', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute(
      'level-data',
      JSON.stringify({
        id: 'stateful-level',
        name: 'Stateful',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      }),
    );
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    const rightButton = buttonByLabel(element, 'R');
    await commitDomUpdate(() => {
      rightButton?.click();
    });

    expect(shadowText(element)).toContain('Moves: 1 | Pushes: 1 | Solved');

    await commitDomUpdate(() => {
      element.setAttribute('theme', 'dark');
    });

    expect(shadowText(element)).toContain('Moves: 1 | Pushes: 1 | Solved');
  });

  it('preserves gameplay state when ignored level-data changes under a valid level-id', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-001');
    element.setAttribute(
      'level-data',
      JSON.stringify({
        id: 'ignored-custom-level',
        name: 'Ignored Custom Level',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      }),
    );
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    const rightButton = buttonByLabel(element, 'R');
    await commitDomUpdate(() => {
      rightButton?.click();
    });

    expect(shadowText(element)).toContain('Classic 1');
    expect(shadowText(element)).toContain('Moves: 1 | Pushes: 0 | In progress');

    await commitDomUpdate(() => {
      element.setAttribute(
        'level-data',
        JSON.stringify({
          id: 'ignored-custom-level-2',
          name: 'Ignored Custom Level 2',
          rows: ['WWWWW', 'WPBWW', 'WWWTW'],
        }),
      );
    });

    expect(shadowText(element)).toContain('Classic 1');
    expect(shadowText(element)).toContain('Moves: 1 | Pushes: 0 | In progress');
  });

  it('unmounts cleanly on disconnect', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    await commitDomUpdate(() => {
      element.remove();
    });

    expect(document.querySelector(EMBED_ELEMENT_TAG)).toBeNull();
  });

  it('reconnects the same element without reattaching shadow DOM', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'classic-001');
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    const firstShadowRoot = element.shadowRoot;
    await commitDomUpdate(() => {
      element.remove();
    });

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(element.shadowRoot).toBe(firstShadowRoot);
    expect(shadowText(element)).toContain('Classic 1');

    await commitDomUpdate(() => {
      element.setAttribute('level-id', 'classic-002');
    });

    expect(shadowText(element)).toContain('Classic 2');
  });
});
