// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { GameMove } from '../../state/gameSlice';
import { MoveHistory } from '../MoveHistory';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];

function createMoves(
  entries: Array<[direction: GameMove['direction'], pushed: boolean]>,
): GameMove[] {
  return entries.map(([direction, pushed]) => ({ direction, pushed }));
}

async function renderMoveHistory(moves: GameMove[]) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<MoveHistory moves={moves} />);
  });

  return container;
}

function getListItems(container: HTMLElement): HTMLLIElement[] {
  return Array.from(container.querySelectorAll('ol[aria-label="Move history"] li'));
}

function getRenderedMoves(container: HTMLElement) {
  return getListItems(container).map((item) => {
    const fields = item.querySelectorAll('div');
    return {
      index: fields[0]?.textContent ?? '',
      direction: fields[1]?.textContent ?? '',
      badge: fields[2]?.textContent ?? '',
    };
  });
}

describe('MoveHistory', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('renders the empty-state hint when no moves have been made', async () => {
    const container = await renderMoveHistory([]);

    expect(container.textContent).toContain(
      'No moves yet. Use the keyboard or sequence input to start.',
    );
    expect(container.querySelector('ol[aria-label="Move history"]')).toBeNull();
  });

  it('renders an accessible ordered list once moves exist', async () => {
    const container = await renderMoveHistory(createMoves([['U', false]]));

    expect(container.querySelector('ol[aria-label="Move history"]')).not.toBeNull();
    expect(container.textContent).toContain('Move history');
  });

  it('announces singular move counts in the live region', async () => {
    const container = await renderMoveHistory(createMoves([['U', false]]));
    const status = container.querySelector('[role="status"]');

    expect(status?.textContent).toBe('1 move made');
    expect(container.textContent).toContain('1 total');
  });

  it('announces plural move counts in the live region', async () => {
    const container = await renderMoveHistory(
      createMoves([
        ['U', false],
        ['R', true],
      ]),
    );
    const status = container.querySelector('[role="status"]');

    expect(status?.textContent).toBe('2 moves made');
    expect(container.textContent).toContain('2 total');
  });

  it('shows walk badges for non-push moves', async () => {
    const container = await renderMoveHistory(createMoves([['L', false]]));
    const walkBadge = Array.from(container.querySelectorAll('li div')).find(
      (element) => element.textContent === 'walk',
    );

    expect(walkBadge?.className).toContain('bg-slate-500/20');
  });

  it('shows push badges for pushed moves', async () => {
    const container = await renderMoveHistory(createMoves([['R', true]]));
    const pushBadge = Array.from(container.querySelectorAll('li div')).find(
      (element) => element.textContent === 'push',
    );

    expect(pushBadge?.className).toContain('bg-amber-500/20');
  });

  it('renders the absolute move indices for visible entries', async () => {
    const container = await renderMoveHistory(
      createMoves([
        ['U', false],
        ['D', false],
        ['L', false],
      ]),
    );

    const renderedMoves = getRenderedMoves(container);
    expect(renderedMoves[0]?.index).toBe('#1');
    expect(renderedMoves[1]?.index).toBe('#2');
    expect(renderedMoves[2]?.index).toBe('#3');
  });

  it('renders at most the most recent twelve moves', async () => {
    const moves = createMoves(
      Array.from({ length: 15 }, (_, index): [GameMove['direction'], boolean] => [
        (['U', 'D', 'L', 'R'] as const)[index % 4],
        false,
      ]),
    );
    const container = await renderMoveHistory(moves);

    expect(getListItems(container)).toHaveLength(12);
  });

  it('drops the oldest moves once history exceeds the visible cap', async () => {
    const moves = createMoves(
      Array.from({ length: 13 }, (_, index): [GameMove['direction'], boolean] => [
        (['U', 'D', 'L', 'R'] as const)[index % 4],
        false,
      ]),
    );
    const container = await renderMoveHistory(moves);

    const renderedMoves = getRenderedMoves(container);
    expect(renderedMoves.some((move) => move.index === '#1')).toBe(false);
    expect(renderedMoves[0]?.index).toBe('#2');
    expect(renderedMoves.at(-1)?.index).toBe('#13');
  });

  it('keeps the most recent directions in display order when truncating long histories', async () => {
    const container = await renderMoveHistory(
      createMoves([
        ['U', false],
        ['D', false],
        ['L', false],
        ['R', false],
        ['U', false],
        ['D', false],
        ['L', false],
        ['R', false],
        ['U', false],
        ['D', false],
        ['L', false],
        ['R', false],
        ['U', true],
      ]),
    );

    const renderedMoves = getRenderedMoves(container);
    expect(renderedMoves[0]?.index).toBe('#2');
    expect(renderedMoves[0]?.direction).toBe('D');
    expect(renderedMoves.at(-1)?.index).toBe('#13');
    expect(renderedMoves.at(-1)?.direction).toBe('U');
  });
});
