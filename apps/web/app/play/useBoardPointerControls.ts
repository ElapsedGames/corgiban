import { useEffect } from 'react';

import type { GameState } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

const SWIPE_THRESHOLD = 20;

type BoardPointerHandlers = {
  getGameState: () => GameState;
  onMove: (direction: Direction) => void;
  enabled?: boolean;
};

type PointerSession = {
  pointerId: number;
  startX: number;
  startY: number;
};

type PointerWindowLike = Pick<Window, 'addEventListener' | 'removeEventListener'>;

function getAdjacentMoveDirection(state: GameState, targetIndex: number): Direction | null {
  if (targetIndex === state.playerIndex) {
    return null;
  }

  const width = state.level.width;
  const playerRow = Math.floor(state.playerIndex / width);
  const playerCol = state.playerIndex % width;
  const targetRow = Math.floor(targetIndex / width);
  const targetCol = targetIndex % width;
  const rowDelta = targetRow - playerRow;
  const colDelta = targetCol - playerCol;

  if (Math.abs(rowDelta) + Math.abs(colDelta) !== 1) {
    return null;
  }

  if (rowDelta === -1) {
    return 'U';
  }

  if (rowDelta === 1) {
    return 'D';
  }

  if (colDelta === -1) {
    return 'L';
  }

  return 'R';
}

function getSwipeDirection(deltaX: number, deltaY: number): Direction | null {
  if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) {
    return null;
  }

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX > 0 ? 'R' : 'L';
  }

  if (deltaY > 0) {
    return 'D';
  }

  return 'U';
}

function getTargetIndexFromPoint(
  state: GameState,
  rect: DOMRect,
  clientX: number,
  clientY: number,
): number | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const { width, height } = state.level;
  const col = Math.floor((x / rect.width) * width);
  const row = Math.floor((y / rect.height) * height);

  if (col < 0 || col >= width || row < 0 || row >= height) {
    return null;
  }

  return row * width + col;
}

export function useBoardPointerControls(
  element: HTMLElement | null,
  { getGameState, onMove, enabled = true }: BoardPointerHandlers,
) {
  useEffect(() => {
    if (!enabled || !element) return undefined;

    let activePointer: PointerSession | null = null;
    const pointerWindow =
      element.ownerDocument?.defaultView ??
      (typeof window === 'undefined' ? undefined : (window as PointerWindowLike));

    const clearPointer = (pointerId: number) => {
      if (activePointer?.pointerId !== pointerId) {
        return;
      }

      activePointer = null;
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (activePointer) {
        return;
      }

      if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
      }

      activePointer = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
      };

      if (event.pointerType !== 'mouse') {
        event.preventDefault();
        // Keep touch and pen interactions attached to the board even if the pointer drifts.
        element.setPointerCapture(event.pointerId);
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (activePointer?.pointerId !== event.pointerId) {
        return;
      }

      const pointer = activePointer;
      clearPointer(event.pointerId);

      const swipeDirection = getSwipeDirection(
        event.clientX - pointer.startX,
        event.clientY - pointer.startY,
      );
      if (swipeDirection) {
        onMove(swipeDirection);
        return;
      }

      const state = getGameState();
      const targetIndex = getTargetIndexFromPoint(
        state,
        element.getBoundingClientRect(),
        event.clientX,
        event.clientY,
      );
      if (targetIndex === null) {
        return;
      }

      const direction = getAdjacentMoveDirection(state, targetIndex);
      if (direction) {
        onMove(direction);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      clearPointer(event.pointerId);
    };

    const handleWindowPointerEnd = (event: PointerEvent) => {
      clearPointer(event.pointerId);
    };

    element.addEventListener('pointerdown', handlePointerDown);
    element.addEventListener('pointerup', handlePointerUp);
    element.addEventListener('pointercancel', handlePointerCancel);
    pointerWindow?.addEventListener('pointerup', handleWindowPointerEnd);
    pointerWindow?.addEventListener('pointercancel', handleWindowPointerEnd);

    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      element.removeEventListener('pointerup', handlePointerUp);
      element.removeEventListener('pointercancel', handlePointerCancel);
      pointerWindow?.removeEventListener('pointerup', handleWindowPointerEnd);
      pointerWindow?.removeEventListener('pointercancel', handleWindowPointerEnd);
    };
  }, [element, enabled, getGameState, onMove]);
}
