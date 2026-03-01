import type { GameState } from '../model/gameState';

export type HashState = Pick<GameState, 'playerIndex' | 'boxes'>;

export function normalize(state: HashState): string {
  const sortedBoxes = Array.from(state.boxes).sort((a, b) => a - b);
  return `p:${state.playerIndex}|b:${sortedBoxes.join(',')}`;
}
