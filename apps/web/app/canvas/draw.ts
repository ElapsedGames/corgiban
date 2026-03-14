import {
  DEFAULT_BOARD_RENDER_MODE,
  DEFAULT_BOARD_SKIN_ID,
  resolveBoardPalette,
  type BoardPalette,
} from './boardSkin';
import { paintBoardSprite } from './paintBoardSprite';
import type { RenderPlan } from './renderPlan';
import type { SpriteAtlas } from './spriteAtlas.types';

const fallbackPalette = resolveBoardPalette(DEFAULT_BOARD_SKIN_ID, DEFAULT_BOARD_RENDER_MODE);

function spriteKeyForCell(cell: RenderPlan['cells'][number]): keyof SpriteAtlas['sprites'] {
  if (cell.wall) {
    return 'wall';
  }
  if (cell.player && cell.target) {
    return 'playerOnTarget';
  }
  if (cell.player) {
    return 'player';
  }
  if (cell.box && cell.target) {
    return 'boxOnTarget';
  }
  if (cell.box) {
    return 'box';
  }
  if (cell.target) {
    return 'target';
  }
  return 'floor';
}

const BONE_ROTATION_DEGREES = [-67, -51, -37, -24, -11, 0, 13, 27, 39, 52, 68] as const;

function resolveBoneRotationDegrees(cell: RenderPlan['cells'][number]): number {
  const mixed =
    (cell.index * 73 + cell.row * 151 + cell.col * 197 + cell.index * cell.col * 19) %
    BONE_ROTATION_DEGREES.length;
  return BONE_ROTATION_DEGREES[mixed];
}

function resolveGridStrokeStyle(palette: BoardPalette): string | null {
  switch (palette.gridLineMode) {
    case 'off':
      return null;
    case 'on':
      return palette.gridStrong;
    case 'subtle':
      return palette.grid;
  }
}

export function draw(
  ctx: CanvasRenderingContext2D,
  plan: RenderPlan,
  atlas?: SpriteAtlas | null,
  palette: BoardPalette = fallbackPalette,
): void {
  const { cellSize, dpr, width, height, cells } = plan;
  const logicalWidth = width * cellSize;
  const logicalHeight = height * cellSize;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, logicalWidth, logicalHeight);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  for (const cell of cells) {
    const x = cell.col * cellSize;
    const y = cell.row * cellSize;
    const key = spriteKeyForCell(cell);

    if (cell.box) {
      const boneRotationDegrees =
        palette.boxRotationMode === 'cell-hash' ? resolveBoneRotationDegrees(cell) : 0;
      if (atlas) {
        const baseSprite = atlas.sprites[cell.target ? 'target' : 'floor'];
        ctx.drawImage(baseSprite, x, y, cellSize, cellSize);
      } else {
        paintBoardSprite(ctx, cell.target ? 'target' : 'floor', x, y, cellSize, palette);
      }
      paintBoardSprite(ctx, cell.target ? 'boxOnTarget' : 'box', x, y, cellSize, palette, {
        rotationDegrees: boneRotationDegrees,
      });
      continue;
    }

    if (atlas) {
      const sprite = atlas.sprites[key];
      ctx.drawImage(sprite, x, y, cellSize, cellSize);
      continue;
    }

    paintBoardSprite(ctx, key, x, y, cellSize, palette);
  }

  const gridStrokeStyle = resolveGridStrokeStyle(palette);
  if (gridStrokeStyle) {
    ctx.strokeStyle = gridStrokeStyle;
    ctx.lineWidth = 1;
    for (let row = 0; row <= height; row += 1) {
      const y = row * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(logicalWidth, y);
      ctx.stroke();
    }
    for (let col = 0; col <= width; col += 1) {
      const x = col * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }
  }

  ctx.restore();
}
