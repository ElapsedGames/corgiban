import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GameState } from '@corgiban/core';

const hookState = vi.hoisted(() => ({
  cleanup: undefined as undefined | (() => void),
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: (effect: () => void | (() => void)) => {
      hookState.cleanup = effect() ?? undefined;
    },
  };
});

import { useBoardPointerControls } from '../useBoardPointerControls';

const W = 0;
const F = 1;

function makeGameState(playerIndex = 6): GameState {
  return {
    playerIndex,
    boxes: new Uint32Array([]),
    history: [],
    stats: { moves: 0, pushes: 0 },
    level: {
      levelId: 'test',
      width: 5,
      height: 4,
      // prettier-ignore
      staticGrid: new Uint8Array([
        W, W, W, W, W,
        W, F, F, F, W,
        W, F, F, F, W,
        W, W, W, W, W,
      ]),
      initialPlayerIndex: 6,
      initialBoxes: new Uint32Array([]),
    },
  };
}

type Listener = (event: FakePointerEvent) => void;

type FakePointerEvent = {
  button: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  pointerType: string;
  preventDefault: ReturnType<typeof vi.fn>;
};

class FakeWindow {
  private listeners = new Map<string, Listener[]>();

  addEventListener(type: string, handler: Listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, handler]);
  }

  removeEventListener(type: string, handler: Listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      existing.filter((existingHandler) => existingHandler !== handler),
    );
  }

  dispatch(type: string, event: FakePointerEvent) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }
}

class FakeElement {
  private listeners = new Map<string, Listener[]>();
  private capturedPointers = new Set<number>();
  readonly ownerDocument = {
    defaultView: new FakeWindow(),
  };

  addEventListener(type: string, handler: Listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...existing, handler]);
  }

  removeEventListener(type: string, handler: Listener) {
    const existing = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      existing.filter((existingHandler) => existingHandler !== handler),
    );
  }

  dispatch(type: string, event: FakePointerEvent) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler(event);
    }
  }

  getBoundingClientRect(): DOMRect {
    return {
      left: 0,
      top: 0,
      width: 500,
      height: 400,
      right: 500,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  }

  listenerCount(type: string): number {
    return (this.listeners.get(type) ?? []).length;
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture = vi.fn((pointerId: number) => {
    this.capturedPointers.delete(pointerId);
  });

  setPointerCapture = vi.fn((pointerId: number) => {
    this.capturedPointers.add(pointerId);
  });
}

function makePointerEvent(overrides: Partial<FakePointerEvent> = {}): FakePointerEvent {
  return {
    button: 0,
    clientX: 150,
    clientY: 150,
    pointerId: 1,
    pointerType: 'mouse',
    preventDefault: vi.fn(),
    ...overrides,
  };
}

function dispatchWindowPointerEvent(
  windowLike: FakeWindow,
  type: 'pointerup' | 'pointercancel',
  overrides: Partial<FakePointerEvent> = {},
) {
  windowLike.dispatch(type, makePointerEvent(overrides));
}

describe('useBoardPointerControls', () => {
  let el: FakeElement;

  beforeEach(() => {
    hookState.cleanup = undefined;
    el = new FakeElement();
  });

  it('registers and removes pointer listeners', () => {
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove: () => undefined,
    });

    expect(el.listenerCount('pointerdown')).toBe(1);
    expect(el.listenerCount('pointerup')).toBe(1);
    expect(el.listenerCount('pointercancel')).toBe(1);

    hookState.cleanup?.();

    expect(el.listenerCount('pointerdown')).toBe(0);
    expect(el.listenerCount('pointerup')).toBe(0);
    expect(el.listenerCount('pointercancel')).toBe(0);
  });

  it('does not register when disabled', () => {
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove: () => undefined,
      enabled: false,
    });

    expect(el.listenerCount('pointerdown')).toBe(0);
    expect(hookState.cleanup).toBeUndefined();
  });

  it('does not register when the element is null', () => {
    useBoardPointerControls(null, { getGameState: () => makeGameState(), onMove: () => undefined });

    expect(hookState.cleanup).toBeUndefined();
  });

  it('registers when the element becomes available on a later render', () => {
    useBoardPointerControls(null, { getGameState: () => makeGameState(), onMove: () => undefined });

    expect(hookState.cleanup).toBeUndefined();

    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove: () => undefined,
    });

    expect(el.listenerCount('pointerdown')).toBe(1);
    expect(el.listenerCount('pointerup')).toBe(1);
    expect(el.listenerCount('pointercancel')).toBe(1);
  });

  it('captures the pointer and prevents default for non-mouse input', () => {
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove: () => undefined,
    });

    const event = makePointerEvent({ pointerType: 'touch' });
    el.dispatch('pointerdown', event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(el.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('does not prevent default for mouse input', () => {
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove: () => undefined,
    });

    const event = makePointerEvent({ pointerType: 'mouse' });
    el.dispatch('pointerdown', event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores non-primary mouse buttons', () => {
    const onMove = vi.fn();
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove,
    });

    el.dispatch('pointerdown', makePointerEvent({ button: 1 }));
    el.dispatch('pointerup', makePointerEvent({ button: 1 }));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('moves on swipe gestures', () => {
    const onMove = vi.fn();
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove,
    });

    el.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 100, clientY: 150, pointerId: 7, pointerType: 'touch' }),
    );
    el.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 7, pointerType: 'touch' }),
    );

    expect(onMove).toHaveBeenCalledWith('R');
    expect(el.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it('moves on click or tap of an adjacent tile', () => {
    const onMove = vi.fn();
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove,
    });

    el.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 3, pointerType: 'mouse' }),
    );
    el.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 3, pointerType: 'mouse' }),
    );

    expect(onMove).toHaveBeenCalledWith('R');
  });

  it('ignores clicks on non-adjacent tiles', () => {
    const onMove = vi.fn();
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove,
    });

    el.dispatch('pointerdown', makePointerEvent({ clientX: 350, clientY: 150, pointerId: 3 }));
    el.dispatch('pointerup', makePointerEvent({ clientX: 350, clientY: 150, pointerId: 3 }));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('reads game state at pointer-up time', () => {
    const onMove = vi.fn();
    let currentState = makeGameState(6);
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => currentState,
      onMove,
    });

    el.dispatch('pointerdown', makePointerEvent({ clientX: 350, clientY: 150, pointerId: 4 }));
    currentState = makeGameState(7);
    el.dispatch('pointerup', makePointerEvent({ clientX: 350, clientY: 150, pointerId: 4 }));

    expect(onMove).toHaveBeenCalledWith('R');
  });

  it('clears the active pointer on cancel', () => {
    const onMove = vi.fn();
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove,
    });

    el.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 9, pointerType: 'touch' }),
    );
    el.dispatch('pointercancel', makePointerEvent({ pointerId: 9, pointerType: 'touch' }));
    el.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 9, pointerType: 'touch' }),
    );

    expect(onMove).not.toHaveBeenCalled();
    expect(el.releasePointerCapture).toHaveBeenCalledWith(9);
  });

  it('clears an active mouse pointer when pointerup happens outside the element', () => {
    const onMove = vi.fn();
    useBoardPointerControls(el as unknown as HTMLElement, {
      getGameState: () => makeGameState(),
      onMove,
    });

    el.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 21, pointerType: 'mouse' }),
    );
    dispatchWindowPointerEvent(el.ownerDocument.defaultView, 'pointerup', {
      clientX: 650,
      clientY: 150,
      pointerId: 21,
      pointerType: 'mouse',
    });

    expect(onMove).not.toHaveBeenCalled();

    el.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 22, pointerType: 'mouse' }),
    );
    el.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 250, clientY: 150, pointerId: 22, pointerType: 'mouse' }),
    );

    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('R');
  });
});
