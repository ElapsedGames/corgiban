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

type FakeRect = Pick<
  DOMRect,
  'bottom' | 'height' | 'left' | 'right' | 'top' | 'width' | 'x' | 'y'
> & { toJSON: () => object };

class FakeElement {
  private listeners = new Map<string, Listener[]>();
  private capturedPointers = new Set<number>();
  private rect: FakeRect = {
    left: 0,
    top: 0,
    width: 500,
    height: 400,
    right: 500,
    bottom: 400,
    x: 0,
    y: 0,
    toJSON: () => ({}),
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

  setRect(nextRect: Partial<FakeRect>) {
    this.rect = {
      ...this.rect,
      ...nextRect,
    };
  }

  getBoundingClientRect(): DOMRect {
    return this.rect as DOMRect;
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

function mountPointerControls(element: FakeElement, onMove = vi.fn(), playerIndex = 6) {
  useBoardPointerControls(element as unknown as HTMLElement, {
    getGameState: () => makeGameState(playerIndex),
    onMove,
  });

  return onMove;
}

describe('useBoardPointerControls branch coverage', () => {
  let element: FakeElement;

  beforeEach(() => {
    hookState.cleanup = undefined;
    element = new FakeElement();
  });

  it('ignores a second pointer while another pointer session is active', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 100, clientY: 100, pointerId: 1, pointerType: 'touch' }),
    );
    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 200, clientY: 100, pointerId: 2, pointerType: 'touch' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 250, clientY: 100, pointerId: 2, pointerType: 'touch' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 100, pointerId: 1, pointerType: 'touch' }),
    );

    expect(element.setPointerCapture).toHaveBeenCalledTimes(1);
    expect(element.setPointerCapture).toHaveBeenCalledWith(1);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('R');
  });

  it('ignores cancel events for a different pointer id', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 100, clientY: 150, pointerId: 4, pointerType: 'touch' }),
    );
    element.dispatch('pointercancel', makePointerEvent({ pointerId: 99, pointerType: 'touch' }));
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 4, pointerType: 'touch' }),
    );

    expect(element.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(element.releasePointerCapture).toHaveBeenCalledWith(4);
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith('R');
  });

  it('does not move when the pointer-up target is the player tile', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 3, pointerType: 'mouse' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 3, pointerType: 'mouse' }),
    );

    expect(onMove).not.toHaveBeenCalled();
  });

  it('moves up when the pointer-up target is directly above the player', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 150, clientY: 50, pointerId: 5, pointerType: 'mouse' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 50, pointerId: 5, pointerType: 'mouse' }),
    );

    expect(onMove).toHaveBeenCalledWith('U');
  });

  it('moves down when the pointer-up target is directly below the player', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 150, clientY: 250, pointerId: 6, pointerType: 'mouse' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 250, pointerId: 6, pointerType: 'mouse' }),
    );

    expect(onMove).toHaveBeenCalledWith('D');
  });

  it('moves left when the pointer-up target is directly left of the player', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 50, clientY: 150, pointerId: 7, pointerType: 'mouse' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 50, clientY: 150, pointerId: 7, pointerType: 'mouse' }),
    );

    expect(onMove).toHaveBeenCalledWith('L');
  });

  it('treats a negative horizontal swipe as a left move', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 200, clientY: 150, pointerId: 8, pointerType: 'touch' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 8, pointerType: 'touch' }),
    );

    expect(onMove).toHaveBeenCalledWith('L');
  });

  it('prefers vertical movement when the swipe is taller than it is wide', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 150, clientY: 100, pointerId: 9, pointerType: 'touch' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 160, clientY: 150, pointerId: 9, pointerType: 'touch' }),
    );

    expect(onMove).toHaveBeenCalledWith('D');
  });

  it('returns an up move for a negative vertical swipe', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 150, clientY: 200, pointerId: 10, pointerType: 'touch' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 160, clientY: 150, pointerId: 10, pointerType: 'touch' }),
    );

    expect(onMove).toHaveBeenCalledWith('U');
  });

  it('does not move when the board rect has no drawable size', () => {
    element.setRect({ width: 0, right: 0 });
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 11, pointerType: 'mouse' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: 150, clientY: 150, pointerId: 11, pointerType: 'mouse' }),
    );

    expect(onMove).not.toHaveBeenCalled();
  });

  it('does not move when the pointer-up location falls outside the board bounds', () => {
    const onMove = mountPointerControls(element);

    element.dispatch(
      'pointerdown',
      makePointerEvent({ clientX: -10, clientY: 150, pointerId: 12, pointerType: 'mouse' }),
    );
    element.dispatch(
      'pointerup',
      makePointerEvent({ clientX: -10, clientY: 150, pointerId: 12, pointerType: 'mouse' }),
    );

    expect(onMove).not.toHaveBeenCalled();
  });
});
