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

import {
  GameCanvas,
  renderCanvasFrame,
  resolveResponsiveCellSize,
  subscribeContainerWidth,
  subscribeDevicePixelRatio,
} from '../GameCanvas';

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

  it('derives a smaller responsive cell size when the container is narrow', () => {
    expect(resolveResponsiveCellSize(5, 32, 100)).toBe(20);
    expect(resolveResponsiveCellSize(5, 32, 400)).toBe(32);
    expect(resolveResponsiveCellSize(5, 32, 3)).toBe(1);
  });

  it('keeps the preferred cell size when container width is unavailable', () => {
    expect(resolveResponsiveCellSize(5, 32, null)).toBe(32);
    expect(resolveResponsiveCellSize(5, 32, undefined)).toBe(32);
    expect(resolveResponsiveCellSize(0, 32, 100)).toBe(32);
  });

  it('subscribes to container width with ResizeObserver when available', () => {
    const canvas = {
      width: 0,
      height: 0,
      parentElement: { clientWidth: 144 },
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => null),
    };
    const observe = vi.fn();
    const disconnect = vi.fn();
    const resizeObserverCtor = vi.fn(
      () =>
        ({
          observe,
          disconnect,
        }) as const,
    );
    const updates: number[] = [];

    const unsubscribe = subscribeContainerWidth(canvas, undefined, resizeObserverCtor, (width) =>
      updates.push(width),
    );

    expect(updates).toEqual([144]);
    expect(observe).toHaveBeenCalledWith(canvas.parentElement);

    unsubscribe();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('falls back to window resize events for container width when ResizeObserver is unavailable', () => {
    const container = { clientWidth: 120 };
    const windowLike = {
      devicePixelRatio: 1,
      addEventListener: vi.fn((_event: 'resize', _listener: () => void) => undefined),
      removeEventListener: vi.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      parentElement: container,
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => null),
    };
    const updates: number[] = [];

    const unsubscribe = subscribeContainerWidth(canvas, windowLike, undefined, (width) =>
      updates.push(width),
    );
    const resizeListener = windowLike.addEventListener.mock.calls[0]?.[1];

    expect(updates).toEqual([120]);
    container.clientWidth = 96;
    resizeListener?.();
    expect(updates).toEqual([120, 96]);

    unsubscribe();
    expect(windowLike.removeEventListener).toHaveBeenCalledTimes(1);
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
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => context),
    };

    renderCanvasFrame(canvas, state, 10, 2);

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(60);
    expect(canvas.style.width).toBe('50px');
    expect(canvas.style.maxWidth).toBe('100%');
    expect(canvas.style.height).toBe('auto');
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
        style: { width: '', height: '', maxWidth: '' },
        getContext: vi.fn(() => null),
      },
      state,
      10,
      1,
    );
    expect(mocks.draw).not.toHaveBeenCalled();
  });

  it('keeps the backing-store size when pixel size is unchanged', () => {
    const state = createGame(parseLevel(level));
    const context = { imageSmoothingEnabled: true };
    const canvas = {
      width: 100,
      height: 60,
      style: { width: '50px', height: 'auto', maxWidth: '100%' },
      getContext: vi.fn(() => context),
    };

    renderCanvasFrame(canvas, state, 10, 2);

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(60);
    expect(canvas.style.width).toBe('50px');
    expect(canvas.style.maxWidth).toBe('100%');
    expect(canvas.style.height).toBe('auto');
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(mocks.draw).toHaveBeenCalledTimes(1);
  });

  it('keeps the canvas height responsive when the logical width changes', () => {
    const state = createGame(parseLevel(level));
    const context = { imageSmoothingEnabled: true };
    const canvas = {
      width: 100,
      height: 60,
      style: { width: '50px', height: 'auto', maxWidth: '100%' },
      getContext: vi.fn(() => context),
    };

    renderCanvasFrame(canvas, state, 20, 1);

    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(60);
    expect(canvas.style.width).toBe('100px');
    expect(canvas.style.maxWidth).toBe('100%');
    expect(canvas.style.height).toBe('auto');
    expect(context.imageSmoothingEnabled).toBe(false);
    expect(mocks.draw).toHaveBeenCalledTimes(1);
  });
});
