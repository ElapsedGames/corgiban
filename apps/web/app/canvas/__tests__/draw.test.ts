import { describe, expect, it, vi } from 'vitest';

import { resolveBoardPalette } from '../boardSkin';
import type { RenderPlan } from '../renderPlan';
import { draw } from '../draw';

type MockCanvasContext = CanvasRenderingContext2D & {
  __fillStyles: string[];
  __strokeStyles: string[];
  __lineCaps: CanvasLineCap[];
};

function createContextMock(): MockCanvasContext {
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  const lineCaps: CanvasLineCap[] = [];
  let fillStyle = '';
  let strokeStyle = '';
  let lineCap: CanvasLineCap = 'butt';

  return {
    save: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    closePath: vi.fn(),
    restore: vi.fn(),
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      fillStyles.push(value);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: string) {
      strokeStyle = value;
      strokeStyles.push(value);
    },
    get lineCap() {
      return lineCap;
    },
    set lineCap(value: CanvasLineCap) {
      lineCap = value;
      lineCaps.push(value);
    },
    lineWidth: 0,
    __fillStyles: fillStyles,
    __strokeStyles: strokeStyles,
    __lineCaps: lineCaps,
  } as unknown as MockCanvasContext;
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

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 30, 20);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 30, 20);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.moveTo).toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('draws a bone tile with grass beneath it', () => {
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

    expect(ctx.__fillStyles).toContain('#295931');
    expect(ctx.__fillStyles).toContain('#ebd7aa');
    expect(ctx.__fillStyles).toContain('#b79258');
    expect(ctx.ellipse).toHaveBeenCalled();
  });

  it('uses the themed grass and hedge palette colors in fallback rendering', () => {
    const ctx = createContextMock();
    const plan: RenderPlan = {
      width: 2,
      height: 1,
      cellSize: 10,
      dpr: 1,
      pixelWidth: 20,
      pixelHeight: 10,
      cells: [
        { index: 0, row: 0, col: 0, wall: true, target: false, box: false, player: false },
        { index: 1, row: 0, col: 1, wall: false, target: false, box: false, player: false },
      ],
    };

    draw(ctx, plan);

    expect(ctx.__fillStyles).toContain('#2d3238');
    expect(ctx.__fillStyles).toContain('#295931');
    expect(ctx.__fillStyles).toContain('#5c6570');
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
    expect(ctx.drawImage).toHaveBeenNthCalledWith(4, atlas.sprites.target, 30, 0, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(5, atlas.sprites.floor, 0, 10, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(6, atlas.sprites.target, 10, 10, 10, 10);
    expect(ctx.drawImage).toHaveBeenNthCalledWith(7, atlas.sprites.floor, 20, 10, 10, 10);

    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalledTimes(2);
    expect(ctx.stroke).toHaveBeenCalledTimes(8);
  });

  it('disables box rotation for legacy skin palettes', () => {
    const ctx = createContextMock();
    const legacyPalette = resolveBoardPalette('legacy', 'dark');
    const plan: RenderPlan = {
      width: 1,
      height: 1,
      cellSize: 20,
      dpr: 1,
      pixelWidth: 20,
      pixelHeight: 20,
      cells: [{ index: 3, row: 0, col: 0, wall: false, target: false, box: true, player: false }],
    };

    draw(ctx, plan, null, legacyPalette);

    expect(ctx.rotate).toHaveBeenCalledWith(0);
    expect(ctx.__strokeStyles).toContain(legacyPalette.gridStrong);
  });

  it('can disable grid lines from the palette', () => {
    const ctx = createContextMock();
    const palette = {
      ...resolveBoardPalette('classic', 'dark'),
      gridLineMode: 'off' as const,
    };
    const plan: RenderPlan = {
      width: 1,
      height: 1,
      cellSize: 20,
      dpr: 1,
      pixelWidth: 20,
      pixelHeight: 20,
      cells: [{ index: 0, row: 0, col: 0, wall: false, target: false, box: false, player: false }],
    };

    draw(ctx, plan, null, palette);

    expect(ctx.__strokeStyles).toEqual([]);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
