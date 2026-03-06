import type { Direction } from '@corgiban/shared';

type KeyboardWindowLike = {
  addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
  removeEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
};

type LabKeyboardHandlers = {
  onMove: (direction: Direction) => void;
  onReset: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true;
  }

  return target.isContentEditable;
}

export function subscribeLabKeyboardControls(
  windowLike: KeyboardWindowLike | undefined,
  handlers: LabKeyboardHandlers,
): () => void {
  if (!windowLike) {
    return () => undefined;
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    if (event.defaultPrevented || isTypingTarget(event.target)) {
      return;
    }

    let handled = true;
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        handlers.onMove('U');
        break;
      case 'ArrowDown':
      case 'KeyS':
        handlers.onMove('D');
        break;
      case 'ArrowLeft':
      case 'KeyA':
        handlers.onMove('L');
        break;
      case 'ArrowRight':
      case 'KeyD':
        handlers.onMove('R');
        break;
      case 'KeyR':
        handlers.onReset();
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.preventDefault();
    }
  };

  windowLike.addEventListener('keydown', handleKeyDown);
  return () => {
    windowLike.removeEventListener('keydown', handleKeyDown);
  };
}
