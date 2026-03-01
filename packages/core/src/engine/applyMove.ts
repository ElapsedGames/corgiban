import type { Direction } from '@corgiban/shared';

import { isWall } from '../model/cell';
import type { GameState, HistoryEntry } from '../model/gameState';
import { moveIndex } from '../model/position';
import { moveBoxSorted } from './boxes';

export interface MoveResult {
  state: GameState;
  changed: boolean;
  pushed: boolean;
}

function hasBox(boxes: Uint32Array, index: number): boolean {
  for (const box of boxes) {
    if (box === index) {
      return true;
    }
  }
  return false;
}

export function applyMove(state: GameState, direction: Direction): MoveResult {
  const { level, playerIndex, boxes } = state;
  const nextIndex = moveIndex(playerIndex, level.width, level.height, direction);

  if (nextIndex === null) {
    return { state, changed: false, pushed: false };
  }

  if (isWall(level.staticGrid[nextIndex])) {
    return { state, changed: false, pushed: false };
  }

  const boxAtNext = hasBox(boxes, nextIndex);
  if (!boxAtNext) {
    const historyEntry: HistoryEntry = {
      prevPlayerIndex: playerIndex,
      pushed: false,
    };

    return {
      state: {
        ...state,
        playerIndex: nextIndex,
        history: [...state.history, historyEntry],
        stats: {
          moves: state.stats.moves + 1,
          pushes: state.stats.pushes,
        },
      },
      changed: true,
      pushed: false,
    };
  }

  const beyondIndex = moveIndex(nextIndex, level.width, level.height, direction);

  if (beyondIndex === null) {
    return { state, changed: false, pushed: false };
  }

  if (isWall(level.staticGrid[beyondIndex]) || hasBox(boxes, beyondIndex)) {
    return { state, changed: false, pushed: false };
  }

  const nextBoxes = moveBoxSorted(boxes, nextIndex, beyondIndex);
  const historyEntry: HistoryEntry = {
    prevPlayerIndex: playerIndex,
    movedBoxFrom: nextIndex,
    movedBoxTo: beyondIndex,
    pushed: true,
  };

  return {
    state: {
      ...state,
      playerIndex: nextIndex,
      boxes: nextBoxes,
      history: [...state.history, historyEntry],
      stats: {
        moves: state.stats.moves + 1,
        pushes: state.stats.pushes + 1,
      },
    },
    changed: true,
    pushed: true,
  };
}
