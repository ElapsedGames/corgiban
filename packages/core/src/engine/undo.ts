import type { GameState } from '../model/gameState';

import { moveBoxSorted } from './boxes';

export function undo(state: GameState): GameState {
  if (state.history.length === 0) {
    return state;
  }

  const last = state.history[state.history.length - 1];
  let nextBoxes = state.boxes;

  if (last.pushed) {
    if (last.movedBoxFrom === undefined || last.movedBoxTo === undefined) {
      throw new Error('Invalid history entry for pushed move.');
    }
    nextBoxes = moveBoxSorted(state.boxes, last.movedBoxTo, last.movedBoxFrom);
  }

  return {
    ...state,
    playerIndex: last.prevPlayerIndex,
    boxes: nextBoxes,
    history: state.history.slice(0, -1),
    stats: {
      moves: Math.max(0, state.stats.moves - 1),
      pushes: Math.max(0, state.stats.pushes - (last.pushed ? 1 : 0)),
    },
  };
}
