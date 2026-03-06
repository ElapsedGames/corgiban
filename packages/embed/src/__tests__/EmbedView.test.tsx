import { MAX_IMPORT_BYTES } from '@corgiban/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveEmbedLevelDefinition } from '../EmbedView';
import { EMBED_ELEMENT_TAG, defineCorgibanEmbed } from '../corgibanEmbed';

function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function createEmbedElement(attributes: Record<string, string | boolean>) {
  defineCorgibanEmbed();

  const element = document.createElement(EMBED_ELEMENT_TAG);
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === false) {
      return;
    }

    element.setAttribute(name, value === true ? '' : value);
  });

  return element;
}

async function mountEmbedElement(element: HTMLElement) {
  document.body.append(element);
  await nextTick();
  return element;
}

function buttonByLabel(element: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...(element.shadowRoot?.querySelectorAll('button') ?? [])].find(
    (button): button is HTMLButtonElement => button.textContent?.trim() === label,
  );
}

function listenForDetails<T>(element: HTMLElement, eventName: string): T[] {
  const details: T[] = [];
  element.addEventListener(eventName, (event) => {
    details.push((event as CustomEvent<T>).detail);
  });
  return details;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('resolveEmbedLevelDefinition', () => {
  it('prefers a known built-in level-id over level-data', () => {
    expect(
      resolveEmbedLevelDefinition(
        'classic-003',
        JSON.stringify({
          id: 'custom-level',
          name: 'Custom Level',
          rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'classic-003',
        name: 'Classic 3',
      },
    });

    expect(resolveEmbedLevelDefinition('classic-003', '{')).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'classic-003',
        name: 'Classic 3',
      },
    });
  });

  it('falls back to level-data when level-id is missing or unknown', () => {
    expect(
      resolveEmbedLevelDefinition(
        null,
        JSON.stringify({
          id: 'custom-level',
          name: 'Custom Level',
          rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'custom-level',
        name: 'Custom Level',
      },
    });

    expect(
      resolveEmbedLevelDefinition(
        'missing-id',
        JSON.stringify({
          id: 'custom-level',
          name: 'Custom Level',
          rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'custom-level',
        name: 'Custom Level',
      },
    });
  });

  it('resolves built-in levels when level-data is absent and level-id is known', () => {
    expect(resolveEmbedLevelDefinition('classic-003', null)).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'classic-003',
        name: 'Classic 3',
      },
    });
  });

  it('returns an explicit invalid-level-id result for unknown built-in ids', () => {
    expect(resolveEmbedLevelDefinition('missing-id', null)).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-id',
        levelId: 'missing-id',
        message: 'Unknown level-id "missing-id".',
      },
    });
  });

  it('returns an explicit invalid-level-data result when fallback level-data is malformed', () => {
    expect(resolveEmbedLevelDefinition('missing-id', JSON.stringify(123))).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-data',
        levelId: 'missing-id',
        message: 'level-data must decode to a JSON object.',
      },
    });

    expect(
      resolveEmbedLevelDefinition('missing-id', JSON.stringify({ rows: [123, 'valid'] })),
    ).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-data',
        levelId: 'missing-id',
        message: 'level-data.rows must be an array of strings.',
      },
    });

    expect(
      resolveEmbedLevelDefinition(
        'missing-id',
        JSON.stringify({
          id: 'broken-token-level',
          name: 'Broken Token Level',
          rows: ['WWWWW', 'WPXBW', 'WWWWW'],
        }),
      ),
    ).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-data',
        levelId: 'missing-id',
      },
    });

    expect(
      resolveEmbedLevelDefinition(
        null,
        JSON.stringify({
          id: 'broken-layout-level',
          name: 'Broken Layout Level',
          rows: ['WWWWW', 'WPPBW', 'WWWWW'],
        }),
      ),
    ).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-data',
        levelId: null,
      },
    });
  });

  it('rejects oversized fallback level-data before JSON parsing', () => {
    const oversizedLevelData = JSON.stringify({
      rows: ['W'.repeat(MAX_IMPORT_BYTES)],
    });

    expect(resolveEmbedLevelDefinition('missing-id', oversizedLevelData)).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-data',
        levelId: 'missing-id',
        message: expect.stringContaining('level-data is too large'),
      },
    });
  });

  it('returns an explicit invalid state when neither level-id nor level-data resolve', () => {
    expect(resolveEmbedLevelDefinition(null, null)).toMatchObject({
      status: 'invalid',
      error: {
        code: 'invalid-level-data',
        levelId: null,
        message: 'Embed requires either a valid level-id or valid level-data.',
      },
    });
  });

  it('defaults custom level metadata when id, name, or knownSolution are invalid', () => {
    expect(
      resolveEmbedLevelDefinition(
        null,
        JSON.stringify({
          id: '',
          name: '',
          rows: ['WWW', 'WPW', 'WWW'],
          knownSolution: 'r',
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'embed-custom',
        name: 'Embedded Level',
        rows: ['WWW', 'WPW', 'WWW'],
        knownSolution: 'r',
      },
    });

    expect(
      resolveEmbedLevelDefinition(
        null,
        JSON.stringify({
          id: 'custom',
          name: 'Custom',
          rows: ['WWW', 'WPW', 'WWW'],
          knownSolution: 42,
        }),
      ),
    ).toMatchObject({
      status: 'resolved',
      levelDefinition: {
        id: 'custom',
        name: 'Custom',
        knownSolution: null,
      },
    });
  });
});

describe('EmbedView integration', () => {
  it('renders all board token states and emits unchanged move events for blocked moves', async () => {
    const element = createEmbedElement({
      'level-data': JSON.stringify({
        id: 'token-level',
        name: 'Token Level',
        rows: ['WWWWWWW', 'WQSETBW', 'WEEEEEW', 'WWWWWWW'],
      }),
    });
    const moveDetails = listenForDetails<{
      direction: string;
      changed: boolean;
      pushed: boolean;
      moves: number;
      pushes: number;
      solved: boolean;
    }>(element, 'corgiban:move');

    await mountEmbedElement(element);

    const board = element.shadowRoot?.querySelector('pre');
    expect(board?.textContent).toContain('#+* .$#');

    buttonByLabel(element, 'U')?.click();
    await nextTick();

    expect(moveDetails).toEqual([
      {
        direction: 'U',
        changed: false,
        pushed: false,
        moves: 0,
        pushes: 0,
        solved: false,
      },
    ]);
  });

  it('renders an invalid state and emits corgiban:error when custom level-data is invalid', async () => {
    const element = createEmbedElement({
      'level-id': 'missing-id',
      'level-data': JSON.stringify({
        id: 'broken-layout',
        name: 'Broken Layout',
        rows: ['WWWWW', 'WPPBW', 'WWWWW'],
      }),
    });
    const errorDetails = listenForDetails<{
      code: 'invalid-level-data' | 'invalid-level-id';
      message: string;
      levelId: string | null;
    }>(element, 'corgiban:error');

    await mountEmbedElement(element);

    expect(element.shadowRoot?.textContent).toContain('Embedded level unavailable');
    expect(element.shadowRoot?.textContent).toContain(
      'level-data does not describe a valid Corgiban level',
    );
    expect(element.shadowRoot?.textContent).not.toContain('Classic 3');
    expect(errorDetails).toEqual([
      {
        code: 'invalid-level-data',
        message:
          'level-data does not describe a valid Corgiban level: Level must contain exactly one player.',
        levelId: 'missing-id',
      },
    ]);
  });

  it('falls back to valid level-data when level-id is unknown', async () => {
    const element = createEmbedElement({
      'level-id': 'classic-999',
      'level-data': JSON.stringify({
        id: 'custom-fallback',
        name: 'Custom Fallback',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
      }),
    });
    const errorDetails = listenForDetails<{
      code: 'invalid-level-data' | 'invalid-level-id';
      message: string;
      levelId: string | null;
    }>(element, 'corgiban:error');

    await mountEmbedElement(element);

    expect(element.shadowRoot?.textContent).toContain('Custom Fallback');
    expect(element.shadowRoot?.textContent).not.toContain('Embedded level unavailable');
    expect(errorDetails).toEqual([]);
  });

  it('renders an invalid state and emits corgiban:error when level-id is unknown and level-data is absent', async () => {
    const element = createEmbedElement({
      'level-id': 'classic-999',
    });
    const errorDetails = listenForDetails<{
      code: 'invalid-level-data' | 'invalid-level-id';
      message: string;
      levelId: string | null;
    }>(element, 'corgiban:error');

    await mountEmbedElement(element);

    expect(element.shadowRoot?.textContent).toContain('Embedded level unavailable');
    expect(element.shadowRoot?.textContent).toContain('Unknown level-id "classic-999".');
    expect(errorDetails).toEqual([
      {
        code: 'invalid-level-id',
        message: 'Unknown level-id "classic-999".',
        levelId: 'classic-999',
      },
    ]);
  });

  it('renders an invalid state and emits corgiban:error when both level-id and level-data are absent', async () => {
    const element = createEmbedElement({});
    const errorDetails = listenForDetails<{
      code: 'invalid-level-data' | 'invalid-level-id';
      message: string;
      levelId: string | null;
    }>(element, 'corgiban:error');

    await mountEmbedElement(element);

    expect(element.shadowRoot?.textContent).toContain('Embedded level unavailable');
    expect(element.shadowRoot?.textContent).toContain(
      'Embed requires either a valid level-id or valid level-data.',
    );
    expect(errorDetails).toEqual([
      {
        code: 'invalid-level-data',
        message: 'Embed requires either a valid level-id or valid level-data.',
        levelId: null,
      },
    ]);
  });

  it('disables readonly controls and suppresses move events', async () => {
    const element = createEmbedElement({
      readonly: true,
      'show-solver': true,
      'level-data': JSON.stringify({
        id: 'readonly-level',
        name: 'Readonly',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        knownSolution: 'R',
      }),
    });
    const moveDetails = listenForDetails(element, 'corgiban:move');
    const benchmarkDetails = listenForDetails(element, 'corgiban:benchmarkComplete');

    await mountEmbedElement(element);

    const directionButtons = ['U', 'D', 'L', 'R'].map((label) => buttonByLabel(element, label));
    directionButtons.forEach((button) => expect(button?.disabled).toBe(true));
    expect(buttonByLabel(element, 'Apply Known Solution')?.disabled).toBe(true);

    directionButtons[1]?.click();
    buttonByLabel(element, 'Apply Known Solution')?.click();
    await nextTick();

    expect(moveDetails).toEqual([]);
    expect(benchmarkDetails).toEqual([]);
  });

  it('reports zero-move benchmark completion when no valid known-solution steps exist', async () => {
    const element = createEmbedElement({
      'show-solver': true,
      'level-data': JSON.stringify({
        id: 'empty-solution',
        name: 'Empty Solution',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        knownSolution: '?!',
      }),
    });
    const benchmarkDetails = listenForDetails<{
      source: 'known-solution';
      elapsedMs: number;
      moveCount: number;
      solved: boolean;
    }>(element, 'corgiban:benchmarkComplete');
    const solvedDetails = listenForDetails(element, 'corgiban:solved');

    await mountEmbedElement(element);

    buttonByLabel(element, 'Apply Known Solution')?.click();
    await nextTick();

    expect(benchmarkDetails).toEqual([
      {
        source: 'known-solution',
        elapsedMs: 0,
        moveCount: 0,
        solved: false,
      },
    ]);
    expect(solvedDetails).toEqual([]);
  });

  it('reports only applied moves in benchmarkComplete for known-solution playback', async () => {
    const element = createEmbedElement({
      'show-solver': true,
      'level-data': JSON.stringify({
        id: 'blocked-step-solution',
        name: 'Blocked Step Solution',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        knownSolution: 'UR',
      }),
    });
    const benchmarkDetails = listenForDetails<{
      source: 'known-solution';
      elapsedMs: number;
      moveCount: number;
      solved: boolean;
    }>(element, 'corgiban:benchmarkComplete');

    await mountEmbedElement(element);

    buttonByLabel(element, 'Apply Known Solution')?.click();
    await nextTick();

    expect(benchmarkDetails).toHaveLength(1);
    expect(benchmarkDetails[0]).toMatchObject({
      source: 'known-solution',
      moveCount: 1,
      solved: true,
    });
    expect(benchmarkDetails[0]?.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('falls back to Date.now when performance.now is unavailable for known solutions', async () => {
    vi.stubGlobal('performance', undefined);
    const dateNow = vi.spyOn(Date, 'now').mockImplementation(() => 100);

    const element = createEmbedElement({
      'show-solver': true,
      'level-data': JSON.stringify({
        id: 'date-now-fallback',
        name: 'Date Now Fallback',
        rows: ['WWWWW', 'WPBTW', 'WWWWW'],
        knownSolution: 'R',
      }),
    });
    const benchmarkDetails = listenForDetails<{
      source: 'known-solution';
      elapsedMs: number;
      moveCount: number;
      solved: boolean;
    }>(element, 'corgiban:benchmarkComplete');
    const solvedDetails = listenForDetails<{
      moves: number;
      pushes: number;
      source: 'manual' | 'known-solution';
    }>(element, 'corgiban:solved');

    await mountEmbedElement(element);

    buttonByLabel(element, 'Apply Known Solution')?.click();
    await nextTick();

    expect(benchmarkDetails).toEqual([
      {
        source: 'known-solution',
        elapsedMs: 0,
        moveCount: 1,
        solved: true,
      },
    ]);
    expect(solvedDetails).toEqual([
      {
        moves: 1,
        pushes: 1,
        source: 'known-solution',
      },
    ]);
    expect(dateNow).toHaveBeenCalled();
  });
});
