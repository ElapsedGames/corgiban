import type { GameState } from '@corgiban/core';
import { selectCellAt } from '@corgiban/core';

import type { RenderCell, RenderPlan, RenderPlanOptions } from './renderPlan';

const DEFAULT_CELL_SIZE = 32;

export function buildRenderPlan(state: GameState, options: RenderPlanOptions = {}): RenderPlan {
  const cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
  const dpr = options.dpr ?? 1;
  const width = state.level.width;
  const height = state.level.height;

  const cells: RenderCell[] = [];
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const index = row * width + col;
      const selection = selectCellAt(state, index);
      cells.push({
        index,
        row,
        col,
        wall: selection.wall,
        target: selection.target,
        box: selection.box,
        player: selection.player,
      });
    }
  }

  return {
    width,
    height,
    cellSize,
    dpr,
    pixelWidth: Math.round(width * cellSize * dpr),
    pixelHeight: Math.round(height * cellSize * dpr),
    cells,
  };
}
