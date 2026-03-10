import { useEffect } from 'react';

import type { Direction } from '@corgiban/shared';

type KeyboardHandlers = {
  onMove: (direction: Direction) => void;
  onUndo: () => void;
  onRestart: () => void;
  onNextLevel: () => void;
  isSolved?: boolean;
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

function isInteractiveActivationTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  if (tagName === 'BUTTON' || tagName === 'SUMMARY') {
    return true;
  }

  if (tagName === 'A' && target.hasAttribute('href')) {
    return true;
  }

  const role = target.getAttribute('role');
  return (
    role === 'button' ||
    role === 'link' ||
    role === 'menuitem' ||
    role === 'option' ||
    role === 'radio' ||
    role === 'switch' ||
    role === 'tab' ||
    role === 'treeitem'
  );
}

export function useKeyboardControls({
  onMove,
  onUndo,
  onRestart,
  onNextLevel,
  isSolved = false,
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

      if (event.code === 'Enter' && isInteractiveActivationTarget(event.target)) {
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
        case 'Enter':
          if (isSolved) {
            onNextLevel();
          } else {
            handled = false;
          }
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
  }, [enabled, isSolved, onMove, onNextLevel, onRestart, onUndo]);
}
