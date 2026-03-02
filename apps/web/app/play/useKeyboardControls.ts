import { useEffect } from 'react';

import type { Direction } from '@corgiban/shared';

type KeyboardHandlers = {
  onMove: (direction: Direction) => void;
  onUndo: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  enabled?: boolean;
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

export function useKeyboardControls({
  onMove,
  onUndo,
  onRestart,
  onNextLevel,
  enabled = true,
}: KeyboardHandlers) {
  useEffect(() => {
    if (!enabled) {
      return undefined;
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
          onMove('U');
          break;
        case 'ArrowDown':
        case 'KeyS':
          onMove('D');
          break;
        case 'ArrowLeft':
        case 'KeyA':
          onMove('L');
          break;
        case 'ArrowRight':
        case 'KeyD':
          onMove('R');
          break;
        case 'KeyZ':
        case 'KeyU':
        case 'Backspace':
          onUndo();
          break;
        case 'KeyR':
          onRestart();
          break;
        case 'KeyN':
          onNextLevel();
          break;
        default:
          handled = false;
      }

      if (handled) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, onMove, onNextLevel, onRestart, onUndo]);
}
