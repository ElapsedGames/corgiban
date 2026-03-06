import { describe, expect, it, vi } from 'vitest';

import type { RenderPlan } from '../renderPlan';
import { draw } from '../draw';

function createContextMock() {
  return {
    save: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('draw', () => {
  it('renders walls, floor, targets, boxes, player, and grid lines', () => {
    const ctx = createContextMock();
    const plan: RenderPlan = {
      width: 3,
      height: 2,
      cellSize: 10,
      dpr: 2,
      pixelWidth: 60,
      pixelHeight: 40,
      cells: [
        { index: 0, row: 0, col: 0, wall: true, target: false, box: false, player: false },
        { index: 1, row: 0, col: 1, wall: false, target: true, box: false, player: false },
        { index: 2, row: 1, col: 0, wall: false, target: false, box: true, player: false },
        { index: 3, row: 1, col: 1, wall: false, target: true, box: true, player: false },
        { index: 4, row: 0, col: 2, wall: false, target: false, box: false, player: true },
      ],
    };

    draw(ctx, plan);

    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 30, 20);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 30, 20);

    expect(ctx.arc).toHaveBeenCalledTimes(3);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.moveTo).toHaveBeenCalledTimes(7);
    expect(ctx.lineTo).toHaveBeenCalledTimes(7);
    expect(ctx.stroke).toHaveBeenCalledTimes(9);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });

  it('draws expected box inset geometry', () => {
    const ctx = createContextMock();
    const plan: RenderPlan = {
      width: 1,
      height: 1,
      cellSize: 20,
      dpr: 1,
      pixelWidth: 20,
      pixelHeight: 20,
      cells: [{ index: 0, row: 0, col: 0, wall: false, target: false, box: true, player: false }],
    };

    draw(ctx, plan);

    const fillRectMock = ctx.fillRect as unknown as ReturnType<typeof vi.fn>;

    expect(fillRectMock).toHaveBeenCalledWith(0, 0, 20, 20);
    const boxDrawCall = fillRectMock.mock.calls.find(
      (call: unknown[]) =>
        Math.abs((call[0] as number) - 2.8) < 1e-9 &&
        Math.abs((call[1] as number) - 2.8) < 1e-9 &&
        Math.abs((call[2] as number) - 14.4) < 1e-9 &&
        Math.abs((call[3] as number) - 14.4) < 1e-9,
    );
    expect(boxDrawCall).toBeDefined();
  });

  it('uses sprite atlas images for every cell type when an atlas is provided', () => {
    const ctx = createContextMock();
    const atlas = {
      key: 'atlas-key',
      sprites: {
        floor: {} as ImageBitmap,
        wall: {} as ImageBitmap,
        target: {} as ImageBitmap,
        box: {} as ImageBitmap,
        boxOnTarget: {} as ImageBitmap,
        player: {} as ImageBitmap,
        playerOnTarget: {} as ImageBitmap,
      },
    };
    const plan: RenderPlan = {
      width: 4,
      height: 2,
      cellSize: 10,
      dpr: 1,
      pixelWidth: 40,
      pixelHeight: 20,
      cells: [
        { index: 0, row: 0, col: 0, wall: true, target: false, box: false, player: false },
        { index: 1, row: 0, col: 1, wall: false, target: true, box: false, player: true },
        { index: 2, row: 0, col: 2, wall: false, target: false, box: false, player: true },
        { index: 3, row: 0, col: 3, wall: false, target: true, box: true, player: false },
        { index: 4, row: 1, col: 0, wall: false, target: false, box: true, player: false },
        { index: 5, row: 1, col: 1, wall: false, target: true, box: false, player: false },
        { index: 6, row: 1, col: 2, wall: false, target: false, box: false, player: false },
      ],
    };

    draw(ctx, plan, atlas);

    expect(ctx.drawImage).toHaveBeenNthCalledWith(1, atlas.sprites.wall, 0, 0, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(2, atlas.sprites.playerOnTarget, 10, 0, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(3, atlas.sprites.player, 20, 0, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(4, atlas.sprites.boxOnTarget, 30, 0, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(5, atlas.sprites.box, 0, 10, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(6, atlas.sprites.target, 10, 10, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(7, atlas.sprites.floor, 20, 10, 10, 10);

    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
    expect(ctx.arc).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalledTimes(8);
  });
});
