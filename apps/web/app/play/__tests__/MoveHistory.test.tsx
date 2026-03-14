// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameMove } from '../../state/gameSlice';
import { MoveHistory } from '../MoveHistory';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const mountedRoots: Root[] = [];
const clipboardState = vi.hoisted(() => ({
  writeText: vi.fn(),
}));

function createMoves(
  entries: Array<[direction: GameMove['direction'], pushed: boolean]>,
): GameMove[] {
  return entries.map(([direction, pushed]) => ({ direction, pushed }));
}

async function renderMoveHistory(moves: GameMove[]) {
  return renderMoveHistoryWithProps({ moves });
}

async function renderMoveHistoryWithProps(props: Parameters<typeof MoveHistory>[0]) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<MoveHistory {...props} />);
  });

  return container;
}

describe('MoveHistory', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clipboardState.writeText.mockReset();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardState.writeText,
      },
    });
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }
  });

  it('renders a compact history summary with the total count', async () => {
    const container = await renderMoveHistory(
      createMoves([
        ['U', false],
        ['R', true],
      ]),
    );

    expect(container.textContent).toContain('Move History');
    expect(container.textContent).toContain('2 total');
    expect(container.textContent).toContain('Copy Move List');
    expect(container.querySelector('ol[aria-label="Move history"]')).toBeNull();
  });

  it('disables copying when no moves have been made', async () => {
    const container = await renderMoveHistory([]);
    const button = container.querySelector('button');

    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('copies the move directions as a compact move string', async () => {
    clipboardState.writeText.mockResolvedValue(undefined);
    const container = await renderMoveHistory(
      createMoves([
        ['U', false],
        ['R', true],
        ['L', false],
      ]),
    );
    const button = container.querySelector('button');

    expect(button).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      (button as HTMLButtonElement).click();
    });

    expect(clipboardState.writeText).toHaveBeenCalledWith('URL');
  });

  it('announces a copy failure when the clipboard write rejects', async () => {
    clipboardState.writeText.mockRejectedValue(new Error('clipboard failed'));
    const container = await renderMoveHistory(createMoves([['D', false]]));
    const button = container.querySelector('button');
    const status = container.querySelector('[role="status"]');

    expect(button).toBeInstanceOf(HTMLButtonElement);
    expect(status).toBeInstanceOf(HTMLElement);

    await act(async () => {
      (button as HTMLButtonElement).click();
    });

    expect(status?.textContent).toBe('Move list could not be copied.');
  });

  it('renders copy-only mode without the desktop history summary wrapper', async () => {
    const container = await renderMoveHistoryWithProps({
      moves: createMoves([
        ['U', false],
        ['R', true],
      ]),
      mode: 'copyOnly',
    });

    expect(container.textContent).toContain('Copy Move List');
    expect(container.textContent).not.toContain('Move History');
    expect(container.textContent).not.toContain('2 total');
    expect(container.querySelector('div.rounded-app-md.border.border-border.p-3')).toBeNull();
  });
});
