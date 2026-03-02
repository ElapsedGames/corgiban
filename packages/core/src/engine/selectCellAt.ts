import { isTarget, isWall } from '../model/cell';
import type { GameState } from '../model/gameState';
import type { LevelRuntime } from '../model/level';

export type CellSelection = {
  wall: boolean;
  target: boolean;
  box: boolean;
  player: boolean;
};

function hasBox(boxes: Uint32Array, index: number): boolean {
  for (const box of boxes) {
    if (box === index) {
      return true;
    }
  }
  return false;
}

export function selectCellAt(source: GameState | LevelRuntime, index: number): CellSelection {
  if ('level' in source) {
    const cell = source.level.staticGrid[index];
    return {
      wall: isWall(cell),
      target: isTarget(cell),
      box: hasBox(source.boxes, index),
      player: source.playerIndex === index,
    };
  }

  const cell = source.staticGrid[index];
  return {
    wall: isWall(cell),
    target: isTarget(cell),
    box: false,
    player: false,
  };
}
