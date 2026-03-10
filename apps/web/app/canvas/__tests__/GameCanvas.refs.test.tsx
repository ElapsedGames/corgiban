// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGame, parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';

const mocks = vi.hoisted(() => ({
  draw: vi.fn(),
  getSpriteAtlas: vi.fn(async () => null),
  retainSpriteAtlas: vi.fn(),
  releaseSpriteAtlas: vi.fn(),
}));

vi.mock('../draw', () => ({
  draw: mocks.draw,
}));

vi.mock('../spriteAtlas.client', () => ({
  getSpriteAtlas: mocks.getSpriteAtlas,
  retainSpriteAtlas: mocks.retainSpriteAtlas,
  releaseSpriteAtlas: mocks.releaseSpriteAtlas,
}));

import { GameCanvas } from '../GameCanvas';

Object.assign(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }, {
  IS_REACT_ACT_ENVIRONMENT: true,
});

const level: LevelDefinition = {
  id: 'canvas-refs',
  name: 'Canvas Refs',
  rows: ['WWWWW', 'WPEEW', 'WWWWW'],
};

const mountedRoots: Root[] = [];

async function renderCanvas(
  canvasRef: ComponentProps<typeof GameCanvas>['canvasRef'],
  state = createGame(parseLevel(level)),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(<GameCanvas state={state} canvasRef={canvasRef} />);
  });

  return { container, root };
}

describe('GameCanvas refs', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1,
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {
          return undefined;
        }

        disconnect() {
          return undefined;
        }
      },
    );
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({ imageSmoothingEnabled: true })),
    });
  });

  afterEach(async () => {
    while (mountedRoots.length > 0) {
      const root = mountedRoots.pop();
      await act(async () => {
        root?.unmount();
      });
    }

    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('assigns callback refs on mount and clears them on unmount', async () => {
    const callbackRef = vi.fn();
    const { container, root } = await renderCanvas(callbackRef);
    const canvas = container.querySelector('canvas');

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(callbackRef).toHaveBeenCalledWith(canvas);

    await act(async () => {
      root.unmount();
    });

    expect(callbackRef).toHaveBeenLastCalledWith(null);
  });

  it('assigns object refs on mount and clears them on unmount', async () => {
    const objectRef = { current: null as HTMLCanvasElement | null };
    const { container, root } = await renderCanvas(objectRef);
    const canvas = container.querySelector('canvas');

    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(objectRef.current).toBe(canvas);

    await act(async () => {
      root.unmount();
    });

    expect(objectRef.current).toBeNull();
  });
});
