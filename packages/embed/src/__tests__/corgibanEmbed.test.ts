import { act } from 'react';
import { builtinLevels } from '@corgiban/levels';
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

function builtinLevelName(levelId: string): string {
  const level = builtinLevels.find((entry) => entry.id === levelId);
  if (!level) {
    throw new Error(`Missing built-in level for test id "${levelId}".`);
  }

  return level.name;
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
    element.setAttribute('level-id', 'corgiban-test-22');
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(element.shadowRoot).toBeTruthy();
    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-22'));

    await commitDomUpdate(() => {
      element.setAttribute('level-id', 'corgiban-test-26');
    });

    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-26'));
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

  it('emits a synthetic benchmarkComplete payload when show-solver is enabled', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'corgiban-test-18');
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

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          source: 'known-solution',
          synthetic: true,
        }),
      }),
    );
  });

  it('prefers a valid level-id over invalid level-data and does not emit an error', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'corgiban-test-26');
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
    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-26'));
    expect(shadowText(element)).not.toContain('Embedded level unavailable');
  });

  it('emits a structured error and renders an invalid state for unknown built-in level ids', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'corgiban-test-999');

    const handler = vi.fn();
    element.addEventListener('corgiban:error', handler);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          code: 'invalid-level-id',
          levelId: 'corgiban-test-999',
          message: 'Unknown level-id "corgiban-test-999".',
        }),
      }),
    );
    expect(shadowText(element)).toContain('Embedded level unavailable');
    expect(shadowText(element)).toContain('Unknown level-id "corgiban-test-999".');
  });

  it('falls back to level-data when level-id is unknown', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'corgiban-test-999');
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
    element.setAttribute('level-id', 'corgiban-test-18');
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

    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-18'));
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

    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-18'));
    expect(shadowText(element)).toContain('Moves: 1 | Pushes: 0 | In progress');
  });

  it('clears shadow DOM content on disconnect before reconnecting', async () => {
    defineCorgibanEmbed();

    const element = document.createElement(EMBED_ELEMENT_TAG);
    element.setAttribute('level-id', 'corgiban-test-18');
    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(element.shadowRoot?.querySelectorAll('style')).toHaveLength(1);
    expect(element.shadowRoot?.querySelectorAll('[data-corgiban-embed-root]')).toHaveLength(1);

    await commitDomUpdate(() => {
      element.remove();
    });

    const firstShadowRoot = element.shadowRoot;
    expect(firstShadowRoot?.childElementCount).toBe(0);

    await commitDomUpdate(() => {
      document.body.append(element);
    });

    expect(element.shadowRoot).toBe(firstShadowRoot);
    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-18'));
    expect(element.shadowRoot?.querySelectorAll('style')).toHaveLength(1);
    expect(element.shadowRoot?.querySelectorAll('[data-corgiban-embed-root]')).toHaveLength(1);

    await commitDomUpdate(() => {
      element.setAttribute('level-id', 'corgiban-test-22');
    });

    expect(shadowText(element)).toContain(builtinLevelName('corgiban-test-22'));
  });
});
