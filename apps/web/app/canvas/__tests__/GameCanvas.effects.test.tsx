import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGame, parseLevel } from '@corgiban/core';
import type { LevelDefinition } from '@corgiban/levels';

const level: LevelDefinition = {
  id: 'canvas-effects',
  name: 'Canvas Effects',
  rows: ['WWWWW', 'WPEEW', 'WWWWW'],
};

describe('GameCanvas effects', () => {
  const resolveInitialState = <T,>(initialValue: T | (() => T)): T =>
    typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;

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
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('window', {
      devicePixelRatio: 2,
      addEventListener,
      removeEventListener,
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(_callback: () => void) {}

        observe = observe;
        disconnect = disconnect;
      },
    );

    const drawMock = vi.fn();
    const cleanups: Array<() => void> = [];
    const setDpr = vi.fn();
    const setContainerWidth = vi.fn();
    const setAtlas = vi.fn();
    let stateCallCount = 0;

    const canvasContext = {
      imageSmoothingEnabled: true,
    };
    const canvas = {
      width: 0,
      height: 0,
      parentElement: { clientWidth: 40 },
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => canvasContext),
    };

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      const runEffect = (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      };
      return {
        ...actual,
        useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
        useEffect: runEffect,
        useLayoutEffect: runEffect,
        useRef: () => ({ current: canvas }),
        useState: <T,>(initialValue: T | (() => T)) => {
          stateCallCount += 1;
          if (stateCallCount === 1) {
            return [initialValue, setDpr];
          }

          if (stateCallCount === 2) {
            return [40, setContainerWidth];
          }

          if (stateCallCount === 3) {
            return [initialValue, setAtlas];
          }

          return [resolveInitialState(initialValue), vi.fn()];
        },
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
    expect(canvas.width).toBe(40);
    expect(canvas.height).toBe(24);
    expect(canvas.style.width).toBe('40px');
    expect(canvas.style.maxWidth).toBe('100%');
    expect(canvas.style.height).toBe('auto');
    expect(drawMock).toHaveBeenCalledTimes(1);
    expect(addEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(setDpr).toHaveBeenCalledWith(2);
    expect(setContainerWidth).toHaveBeenCalledWith(40);
    expect(observe).toHaveBeenCalledWith(canvas.parentElement);

    cleanups.forEach((cleanup) => cleanup());
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('skips dpr subscription when window is unavailable while still rendering frame effects', async () => {
    vi.stubGlobal('window', undefined as never);

    const drawMock = vi.fn();
    const cleanups: Array<() => void> = [];
    const setDpr = vi.fn();
    const setContainerWidth = vi.fn();
    const setAtlas = vi.fn();
    let stateCallCount = 0;

    const canvasContext = {
      imageSmoothingEnabled: true,
    };
    const canvas = {
      width: 0,
      height: 0,
      parentElement: { clientWidth: 40 },
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => canvasContext),
    };

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      const runEffect = (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      };
      return {
        ...actual,
        useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
        useEffect: runEffect,
        useLayoutEffect: runEffect,
        useRef: () => ({ current: canvas }),
        useState: <T,>(initialValue: T | (() => T)) => {
          stateCallCount += 1;
          if (stateCallCount === 1) {
            return [initialValue, setDpr];
          }

          if (stateCallCount === 2) {
            return [40, setContainerWidth];
          }

          if (stateCallCount === 3) {
            return [initialValue, setAtlas];
          }

          return [resolveInitialState(initialValue), vi.fn()];
        },
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
    expect(setContainerWidth).toHaveBeenCalledWith(40);
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
      parentElement: null,
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => canvasContext),
    };

    const atlas = {
      key: 'classic:light:10:1',
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
      const runEffect = (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      };
      return {
        ...actual,
        useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
        useEffect: runEffect,
        useLayoutEffect: runEffect,
        useRef: () => ({ current: canvas }),
        useState: <T,>(initialValue: T | (() => T)) => {
          stateCallCount += 1;
          if (stateCallCount === 1) {
            return [initialValue, setDpr];
          }

          if (stateCallCount === 2) {
            return [initialValue, vi.fn()];
          }

          if (stateCallCount === 3) {
            return [initialValue, setAtlas];
          }

          return [resolveInitialState(initialValue), vi.fn()];
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

    expect(getSpriteAtlasMock).toHaveBeenCalledWith(10, 1, 'classic', 'light');
    expect(retainSpriteAtlasMock).toHaveBeenCalledWith(atlas);
    expect(setAtlas).toHaveBeenCalledWith(atlas);
    expect(drawMock).toHaveBeenCalledTimes(1);

    cleanups.forEach((cleanup) => cleanup());
    expect(releaseSpriteAtlasMock).toHaveBeenCalledWith(atlas);
    expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
  });

  it('ignores atlas resolutions that arrive after cleanup', async () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', {
      devicePixelRatio: 1,
      addEventListener,
      removeEventListener,
    });

    const cleanups: Array<() => void> = [];
    const setAtlas = vi.fn();
    let stateCallCount = 0;
    const canvas = {
      width: 0,
      height: 0,
      parentElement: null,
      style: { width: '', height: '', maxWidth: '' },
      getContext: vi.fn(() => null),
    };
    const atlas = {
      key: 'classic:light:10:1',
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
    let resolveAtlas!: (value: typeof atlas | null) => void;
    const getSpriteAtlasMock = vi.fn(
      () =>
        new Promise<typeof atlas | null>((resolve) => {
          resolveAtlas = resolve;
        }),
    );
    const retainSpriteAtlasMock = vi.fn();
    const releaseSpriteAtlasMock = vi.fn();

    vi.doMock('react', async (importOriginal) => {
      const actual = await importOriginal<typeof import('react')>();
      const runEffect = (effect: () => void | (() => void)) => {
        const cleanup = effect();
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      };
      return {
        ...actual,
        useCallback: <T extends (...args: never[]) => unknown>(callback: T) => callback,
        useEffect: runEffect,
        useLayoutEffect: runEffect,
        useRef: () => ({ current: canvas }),
        useState: <T,>(initialValue: T | (() => T)) => {
          stateCallCount += 1;
          if (stateCallCount < 3) {
            return [initialValue, vi.fn()];
          }

          if (stateCallCount === 3) {
            return [initialValue, setAtlas];
          }

          return [resolveInitialState(initialValue), vi.fn()];
        },
      };
    });
    vi.doMock('../spriteAtlas.client', () => ({
      getSpriteAtlas: getSpriteAtlasMock,
      retainSpriteAtlas: retainSpriteAtlasMock,
      releaseSpriteAtlas: releaseSpriteAtlasMock,
    }));

    const { GameCanvas } = await import('../GameCanvas');

    GameCanvas({
      state: createGame(parseLevel(level)),
      cellSize: 10,
    });

    cleanups[cleanups.length - 1]?.();
    resolveAtlas(atlas);
    await Promise.resolve();
    await Promise.resolve();

    expect(retainSpriteAtlasMock).not.toHaveBeenCalled();
    expect(setAtlas).not.toHaveBeenCalled();
    expect(releaseSpriteAtlasMock).toHaveBeenCalledWith(null);
  });
});
