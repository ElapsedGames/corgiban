import type { RenderPlan } from './renderPlan';
import type { SpriteAtlas } from './spriteAtlas.types';

const palette = {
  background: '#0b1120',
  floor: '#111827',
  wall: '#1f2937',
  target: '#22d3ee',
  box: '#f59e0b',
  boxOnTarget: '#fb923c',
  player: '#38bdf8',
  grid: 'rgba(148, 163, 184, 0.15)',
};

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

export function draw(
  ctx: CanvasRenderingContext2D,
  plan: RenderPlan,
  atlas?: SpriteAtlas | null,
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

    if (atlas) {
      const key = spriteKeyForCell(cell);
      const sprite = atlas.sprites[key];
      ctx.drawImage(sprite, x, y, cellSize, cellSize);
      continue;
    }

    if (cell.wall) {
      ctx.fillStyle = palette.wall;
      ctx.fillRect(x, y, cellSize, cellSize);
      continue;
    }

    ctx.fillStyle = palette.floor;
    ctx.fillRect(x, y, cellSize, cellSize);

    if (cell.target) {
      ctx.strokeStyle = palette.target;
      ctx.lineWidth = Math.max(2, cellSize * 0.08);
      const radius = cellSize * 0.22;
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (cell.box) {
      ctx.fillStyle = cell.target ? palette.boxOnTarget : palette.box;
      const inset = cellSize * 0.14;
      ctx.fillRect(x + inset, y + inset, cellSize - inset * 2, cellSize - inset * 2);
    }

    if (cell.player) {
      ctx.fillStyle = palette.player;
      const radius = cellSize * 0.24;
      ctx.beginPath();
      ctx.arc(x + cellSize / 2, y + cellSize / 2, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = palette.grid;
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

  ctx.restore();
}
