import type { GameState } from '../model/gameState';

export function restart(state: GameState): GameState {
  return {
    ...state,
    playerIndex: state.level.initialPlayerIndex,
    boxes: new Uint32Array(state.level.initialBoxes),
    history: [],
    stats: {
      moves: 0,
      pushes: 0,
    },
  };
}
