import { beforeEach, describe, expect, it, vi } from 'vitest';

import { subscribeLabKeyboardControls } from '../labKeyboard';

class FakeHTMLElement extends EventTarget {
  public tagName = 'DIV';
  public isContentEditable = false;
}

type FakeKeyboardEvent = {
  code: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
  target: EventTarget | null;
  preventDefault: ReturnType<typeof vi.fn>;
};

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

describe('labKeyboard', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('HTMLElement', FakeHTMLElement as never);
  });

  it('registers and removes the keydown listener', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    const unsubscribe = subscribeLabKeyboardControls(
      { addEventListener, removeEventListener },
      {
        onMove: () => undefined,
        onReset: () => undefined,
      },
    );

    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));

    const handler = addEventListener.mock.calls[0]?.[1];
    unsubscribe();

    expect(removeEventListener).toHaveBeenCalledWith('keydown', handler);
  });

  it('returns a noop unsubscribe when window is unavailable', () => {
    const unsubscribe = subscribeLabKeyboardControls(undefined, {
      onMove: () => undefined,
      onReset: () => undefined,
    });

    expect(() => unsubscribe()).not.toThrow();
  });

  it('maps movement and reset keys to handlers', () => {
    let keydownHandler: ((event: FakeKeyboardEvent) => void) | undefined;

    subscribeLabKeyboardControls(
      {
        addEventListener: (_type, listener) => {
          keydownHandler = listener as unknown as (event: FakeKeyboardEvent) => void;
        },
        removeEventListener: () => undefined,
      },
      {
        onMove: vi.fn(),
        onReset: vi.fn(),
      },
    );

    const onMove = vi.fn();
    const onReset = vi.fn();
    subscribeLabKeyboardControls(
      {
        addEventListener: (_type, listener) => {
          keydownHandler = listener as unknown as (event: FakeKeyboardEvent) => void;
        },
        removeEventListener: () => undefined,
      },
      { onMove, onReset },
    );

    const cases: Array<[string, () => void]> = [
      ['ArrowUp', () => expect(onMove).toHaveBeenCalledWith('U')],
      ['KeyW', () => expect(onMove).toHaveBeenCalledWith('U')],
      ['ArrowDown', () => expect(onMove).toHaveBeenCalledWith('D')],
      ['ArrowLeft', () => expect(onMove).toHaveBeenCalledWith('L')],
      ['ArrowRight', () => expect(onMove).toHaveBeenCalledWith('R')],
      ['KeyR', () => expect(onReset).toHaveBeenCalled()],
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

  it('ignores modified, prevented, and typing-target events', () => {
    let keydownHandler: ((event: FakeKeyboardEvent) => void) | undefined;
    const onMove = vi.fn();
    const onReset = vi.fn();

    subscribeLabKeyboardControls(
      {
        addEventListener: (_type, listener) => {
          keydownHandler = listener as unknown as (event: FakeKeyboardEvent) => void;
        },
        removeEventListener: () => undefined,
      },
      { onMove, onReset },
    );

    keydownHandler?.(createEvent('ArrowUp', { metaKey: true }));
    keydownHandler?.(createEvent('ArrowUp', { ctrlKey: true }));
    keydownHandler?.(createEvent('ArrowUp', { altKey: true }));
    keydownHandler?.(createEvent('ArrowUp', { defaultPrevented: true }));

    const input = new FakeHTMLElement();
    input.tagName = 'INPUT';
    keydownHandler?.(createEvent('ArrowUp', { target: input }));

    const textarea = new FakeHTMLElement();
    textarea.tagName = 'TEXTAREA';
    keydownHandler?.(createEvent('ArrowUp', { target: textarea }));

    const contentEditable = new FakeHTMLElement();
    contentEditable.isContentEditable = true;
    keydownHandler?.(createEvent('ArrowUp', { target: contentEditable }));

    expect(onMove).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });
});
