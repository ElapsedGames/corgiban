import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { useKeyboardControls } from '../useKeyboardControls';

type FakeKeyboardEvent = {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
  preventDefault: ReturnType<typeof vi.fn>;
};

class FakeHTMLElement extends EventTarget {
  public tagName = 'DIV';
  public isContentEditable = false;
}

function createEvent(
  code: string,
  overrides: Partial<Omit<FakeKeyboardEvent, 'code'>> = {},
): FakeKeyboardEvent {
  return {
    code,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    defaultPrevented: false,
    target: null,
    preventDefault: vi.fn(),
    ...overrides,
  };
}

describe('useKeyboardControls', () => {
  beforeEach(() => {
    hookState.cleanup = undefined;
    vi.unstubAllGlobals();
    vi.stubGlobal('HTMLElement', FakeHTMLElement as never);
  });

  it('registers and removes the keydown listener when enabled', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });

    useKeyboardControls({
      onMove: () => undefined,
      onUndo: () => undefined,
      onRestart: () => undefined,
      onNextLevel: () => undefined,
    });

    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    const handler = addEventListener.mock.calls[0]?.[1];
    hookState.cleanup?.();
    expect(removeEventListener).toHaveBeenCalledWith('keydown', handler);
  });

  it('does not register listeners when disabled', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.stubGlobal('window', { addEventListener, removeEventListener });

    useKeyboardControls({
      onMove: () => undefined,
      onUndo: () => undefined,
      onRestart: () => undefined,
      onNextLevel: () => undefined,
      enabled: false,
    });

    expect(addEventListener).not.toHaveBeenCalled();
    expect(hookState.cleanup).toBeUndefined();
  });

  it('maps movement and action keys to handlers and prevents defaults', () => {
    let keydownHandler: ((event: FakeKeyboardEvent) => void) | undefined;
    vi.stubGlobal('window', {
      addEventListener: (_type: string, handler: (event: FakeKeyboardEvent) => void) => {
        keydownHandler = handler;
      },
      removeEventListener: () => undefined,
    });

    const onMove = vi.fn();
    const onUndo = vi.fn();
    const onRestart = vi.fn();
    const onNextLevel = vi.fn();

    useKeyboardControls({ onMove, onUndo, onRestart, onNextLevel });
    expect(keydownHandler).toBeTypeOf('function');

    const cases: Array<[string, () => void]> = [
      ['ArrowUp', () => expect(onMove).toHaveBeenCalledWith('U')],
      ['ArrowDown', () => expect(onMove).toHaveBeenCalledWith('D')],
      ['KeyS', () => expect(onMove).toHaveBeenCalledWith('D')],
      ['ArrowLeft', () => expect(onMove).toHaveBeenCalledWith('L')],
      ['KeyA', () => expect(onMove).toHaveBeenCalledWith('L')],
      ['KeyD', () => expect(onMove).toHaveBeenCalledWith('R')],
      ['KeyZ', () => expect(onUndo).toHaveBeenCalled()],
      ['KeyU', () => expect(onUndo).toHaveBeenCalled()],
      ['Backspace', () => expect(onUndo).toHaveBeenCalled()],
      ['KeyR', () => expect(onRestart).toHaveBeenCalled()],
      ['KeyN', () => expect(onNextLevel).toHaveBeenCalled()],
    ];

    for (const [code, assertion] of cases) {
      const event = createEvent(code);
      keydownHandler?.(event);
      assertion();
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    }

    const unknown = createEvent('KeyQ');
    keydownHandler?.(unknown);
    expect(unknown.preventDefault).not.toHaveBeenCalled();
  });

  it('ignores modified and already prevented events', () => {
    let keydownHandler: ((event: FakeKeyboardEvent) => void) | undefined;
    vi.stubGlobal('window', {
      addEventListener: (_type: string, handler: (event: FakeKeyboardEvent) => void) => {
        keydownHandler = handler;
      },
      removeEventListener: () => undefined,
    });

    const onMove = vi.fn();

    useKeyboardControls({
      onMove,
      onUndo: () => undefined,
      onRestart: () => undefined,
      onNextLevel: () => undefined,
    });

    keydownHandler?.(createEvent('ArrowUp', { metaKey: true }));
    keydownHandler?.(createEvent('ArrowUp', { ctrlKey: true }));
    keydownHandler?.(createEvent('ArrowUp', { altKey: true }));
    keydownHandler?.(createEvent('ArrowUp', { defaultPrevented: true }));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('ignores typing targets and allows non-element targets', () => {
    let keydownHandler: ((event: FakeKeyboardEvent) => void) | undefined;
    vi.stubGlobal('window', {
      addEventListener: (_type: string, handler: (event: FakeKeyboardEvent) => void) => {
        keydownHandler = handler;
      },
      removeEventListener: () => undefined,
    });

    const onMove = vi.fn();
    useKeyboardControls({
      onMove,
      onUndo: () => undefined,
      onRestart: () => undefined,
      onNextLevel: () => undefined,
    });

    const input = new FakeHTMLElement();
    input.tagName = 'INPUT';
    keydownHandler?.(createEvent('ArrowRight', { target: input }));

    const contentEditable = new FakeHTMLElement();
    contentEditable.isContentEditable = true;
    keydownHandler?.(createEvent('ArrowRight', { target: contentEditable }));

    expect(onMove).not.toHaveBeenCalled();

    keydownHandler?.(createEvent('ArrowRight', { target: {} as EventTarget }));
    expect(onMove).toHaveBeenCalledWith('R');
  });
});
