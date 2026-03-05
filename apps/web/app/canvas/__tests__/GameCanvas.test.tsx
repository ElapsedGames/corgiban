import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { createGame, parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';

const mocks = vi.hoisted(() => ({
  draw: vi.fn(),
}));

vi.mock('../draw', () => ({
  draw: mocks.draw,
}));

import { GameCanvas, renderCanvasFrame, subscribeDevicePixelRatio } from '../GameCanvas';

const level: LevelDefinition = {
  id: 'canvas-ssr',
  name: 'Canvas SSR',
  rows: ['WWWWW', 'WPEEW', 'WWWWW'],
};

describe('GameCanvas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders during SSR when window is not defined', () => {
    vi.stubGlobal('window', undefined as never);

    const state = createGame(parseLevel(level));
    const html = renderToStaticMarkup(<GameCanvas state={state} />);

    expect(html).toContain('canvas');
  });

  it('subscribes to devicePixelRatio updates and cleans up resize listeners', () => {
    const windowLike = {
      devicePixelRatio: 2,
      addEventListener: vi.fn((_event: 'resize', _listener: () => void) => undefined),
      removeEventListener: vi.fn(),
    };
    const updates: number[] = [];

    const unsubscribe = subscribeDevicePixelRatio(windowLike, (value) => updates.push(value));
    const resizeListener = windowLike.addEventListener.mock.calls[0]?.[1];

    expect(updates).toEqual([2]);
    expect(resizeListener).toBeTypeOf('function');
    windowLike.devicePixelRatio = 3;
    resizeListener?.();
    expect(updates).toEqual([2, 3]);

    unsubscribe();
    expect(windowLike.addEventListener).toHaveBeenCalledTimes(1);
    expect(windowLike.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('returns a noop unsubscribe when window is unavailable', () => {
    const updates: number[] = [];
    const unsubscribe = subscribeDevicePixelRatio(undefined, (value) => updates.push(value));

    expect(updates).toEqual([]);
    expect(() => unsubscribe()).not.toThrow();
  });

  it('falls back to dpr=1 when resize updates report 0 or undefined', () => {
    const windowLike = {
      devicePixelRatio: 0 as number | undefined,
      addEventListener: vi.fn((_event: 'resize', _listener: () => void) => undefined),
      removeEventListener: vi.fn(),
    };
    const updates: number[] = [];

    const unsubscribe = subscribeDevicePixelRatio(windowLike, (value) => updates.push(value));
    const resizeListener = windowLike.addEventListener.mock.calls[0]?.[1];

    expect(updates).toEqual([1]);
    windowLike.devicePixelRatio = undefined;
    resizeListener?.();
    expect(updates).toEqual([1, 1]);

    unsubscribe();
    expect(windowLike.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('renders a canvas frame and updates logical size/style before drawing', () => {
    const state = createGame(parseLevel(level));
    const context = { imageSmoothingEnabled: true };
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn(() => context),
    };

    renderCanvasFrame(canvas, state, 10, 2);

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(60);
    expect(canvas.style.width).toBe('50px');
    expect(canvas.style.height).toBe('30px');
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(mocks.draw).toHaveBeenCalledTimes(1);
  });

  it('does nothing when canvas or context are unavailable', () => {
    const state = createGame(parseLevel(level));

    renderCanvasFrame(null, state, 10, 1);
    expect(mocks.draw).not.toHaveBeenCalled();

    renderCanvasFrame(
      {
        width: 0,
        height: 0,
        style: { width: '', height: '' },
        getContext: vi.fn(() => null),
      },
      state,
      10,
      1,
    );
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it('reuses current canvas dimensions when pixel size is unchanged', () => {
    const state = createGame(parseLevel(level));
    const context = { imageSmoothingEnabled: true };
    const canvas = {
      width: 100,
      height: 60,
      style: { width: 'existing-width', height: 'existing-height' },
      getContext: vi.fn(() => context),
    };

    renderCanvasFrame(canvas, state, 10, 2);

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(60);
    expect(canvas.style.width).toBe('existing-width');
    expect(canvas.style.height).toBe('existing-height');
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(mocks.draw).toHaveBeenCalledTimes(1);
  });
});
