import { isTarget, isWall } from '../model/cell';
import type { GameState } from '../model/gameState';

export function isWin(state: GameState): boolean {
  for (const box of state.boxes) {
    if (!isTarget(state.level.staticGrid[box])) {
      return false;
    }
  }
  return true;
}

export function validateInvariants(state: GameState): void {
  if (isWall(state.level.staticGrid[state.playerIndex])) {
    throw new Error('Player is on a wall cell.');
  }

  const seen = new Set<number>();
  for (const box of state.boxes) {
    if (box === state.playerIndex) {
      throw new Error('Player overlaps a box.');
    }
    if (seen.has(box)) {
      throw new Error('Boxes overlap.');
    }
    seen.add(box);
    if (isWall(state.level.staticGrid[box])) {
      throw new Error('Box is on a wall cell.');
    }
  }
}
