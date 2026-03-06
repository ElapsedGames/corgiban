import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGame, parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';

const level: LevelDefinition = {
  id: 'canvas-effects',
  name: 'Canvas Effects',
  rows: ['WWWWW', 'WPEEW', 'WWWWW'],
};

describe('GameCanvas effects', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.doUnmock('react');
    vi.doUnmock('../draw');
    vi.doUnmock('../spriteAtlas.client');
  });

  it('runs resize and draw effects in hook-driven environments', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', {
      devicePixelRatio: 2,
      addEventListener,
      removeEventListener,
    });

    const drawMock = vi.fn();
    const cleanups: Array<() => void> = [];
    const setDpr = vi.fn();

    const canvasContext = {
      imageSmoothingEnabled: true,
    };
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn(() => canvasContext),
    };

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return {
        ...actual,
        useEffect: (effect: () => void | (() => void)) => {
          const cleanup = effect();
          if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
          }
        },
        useRef: () => ({ current: canvas }),
        useState: (initialValue: number) => [initialValue, setDpr],
      };
    });
    vi.doMock('../draw', () => ({
      draw: drawMock,
    }));

    const { GameCanvas } = await import('../GameCanvas');

    const state = createGame(parseLevel(level));
    const element = GameCanvas({
      state,
      cellSize: 10,
      className: 'canvas-class',
    });

    expect(element.props.className).toBe('canvas-class');
    expect(element.props.role).toBe('img');
    expect(canvas.width).toBe(50);
    expect(canvas.height).toBe(30);
    expect(canvas.style.width).toBe('50px');
    expect(canvas.style.height).toBe('30px');
    expect(drawMock).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(setDpr).toHaveBeenCalledWith(2);

    cleanups.forEach((cleanup) => cleanup());
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('skips dpr subscription when window is unavailable while still rendering frame effects', async () => {
    vi.stubGlobal('window', undefined as never);

    const drawMock = vi.fn();
    const cleanups: Array<() => void> = [];
    const setDpr = vi.fn();

    const canvasContext = {
      imageSmoothingEnabled: true,
    };
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn(() => canvasContext),
    };

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return {
        ...actual,
        useEffect: (effect: () => void | (() => void)) => {
          const cleanup = effect();
          if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
          }
        },
        useRef: () => ({ current: canvas }),
        useState: (initialValue: number) => [initialValue, setDpr],
      };
    });
    vi.doMock('../draw', () => ({
      draw: drawMock,
    }));

    const { GameCanvas } = await import('../GameCanvas');

    const state = createGame(parseLevel(level));
    GameCanvas({
      state,
      cellSize: 10,
    });

    expect(setDpr).not.toHaveBeenCalled();
    expect(drawMock).toHaveBeenCalledTimes(1);

    cleanups.forEach((cleanup) => cleanup());
  });

  it('retains resolved atlases and releases them during cleanup', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      addEventListener,
      removeEventListener,
    });

    const drawMock = vi.fn();
    const cleanups: Array<() => void> = [];
    const setDpr = vi.fn();
    const setAtlas = vi.fn();
    let stateCallCount = 0;

    const canvasContext = {
      imageSmoothingEnabled: true,
    };
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn(() => canvasContext),
    };

    const atlas = {
      key: '10:1',
      sprites: {
        floor: {} as ImageBitmap,
        wall: {} as ImageBitmap,
        target: {} as ImageBitmap,
        box: {} as ImageBitmap,
        boxOnTarget: {} as ImageBitmap,
        player: {} as ImageBitmap,
        playerOnTarget: {} as ImageBitmap,
      },
    };
    const getSpriteAtlasMock = vi.fn(
      () =>
        ({
          then: (onFulfilled: (value: typeof atlas) => void) => Promise.resolve(onFulfilled(atlas)),
        }) as Promise<typeof atlas>,
    );
    const retainSpriteAtlasMock = vi.fn();
    const releaseSpriteAtlasMock = vi.fn();

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      return {
        ...actual,
        useEffect: (effect: () => void | (() => void)) => {
          const cleanup = effect();
          if (typeof cleanup === 'function') {
            cleanups.push(cleanup);
          }
        },
        useRef: () => ({ current: canvas }),
        useState: (initialValue: number | null) => {
          stateCallCount += 1;
          return stateCallCount === 1 ? [initialValue, setDpr] : [initialValue, setAtlas];
        },
      };
    });
    vi.doMock('../draw', () => ({
      draw: drawMock,
    }));
    vi.doMock('../spriteAtlas.client', () => ({
      getSpriteAtlas: getSpriteAtlasMock,
      retainSpriteAtlas: retainSpriteAtlasMock,
      releaseSpriteAtlas: releaseSpriteAtlasMock,
    }));

    const { GameCanvas } = await import('../GameCanvas');

    const state = createGame(parseLevel(level));
    GameCanvas({
      state,
      cellSize: 10,
    });

    expect(getSpriteAtlasMock).toHaveBeenCalledWith(10, 1);
    expect(retainSpriteAtlasMock).toHaveBeenCalledWith(atlas);
    expect(setAtlas).toHaveBeenCalledWith(atlas);
    expect(drawMock).toHaveBeenCalledTimes(1);

    cleanups.forEach((cleanup) => cleanup());
    expect(releaseSpriteAtlasMock).toHaveBeenCalledWith(atlas);
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
