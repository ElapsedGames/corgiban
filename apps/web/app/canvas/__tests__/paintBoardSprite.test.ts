import { describe, expect, it, vi } from 'vitest';

import { resolveBoardPalette } from '../boardSkin';
import { paintBoardSprite } from '../paintBoardSprite';

type MockCanvasContext = CanvasRenderingContext2D & {
  __fillStyles: string[];
  __strokeStyles: string[];
};

function createContextMock(): MockCanvasContext {
  const fillStyles: string[] = [];
  const strokeStyles: string[] = [];
  let fillStyle = '';
  let strokeStyle = '';

  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    lineWidth: 0,
    lineCap: 'butt',
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
    __fillStyles: fillStyles,
    __strokeStyles: strokeStyles,
  } as unknown as MockCanvasContext;
}

describe('paintBoardSprite', () => {
  const palette = resolveBoardPalette('classic', 'light');

  it('paints grass tiles as a simple flat background', () => {
    const ctx = createContextMock();

    paintBoardSprite(ctx, 'floor', 0, 0, 24, palette);

    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 24, 24);
    expect(ctx.__fillStyles).toContain(palette.floor);
    expect(ctx.__fillStyles).toEqual([palette.floor]);
    expect(ctx.__strokeStyles).toEqual([]);
  });

  it('paints target tiles as a dirt hole instead of the old ring marker', () => {
    const ctx = createContextMock();

    paintBoardSprite(ctx, 'target', 0, 0, 24, palette);

    expect(ctx.__fillStyles).toContain(palette.floor);
    expect(ctx.__fillStyles).toContain(palette.target);
    expect(ctx.__fillStyles).toContain(palette.targetDepth);
    expect(ctx.ellipse).toHaveBeenCalled();
    const targetDepthCall = vi.mocked(ctx.ellipse).mock.calls[2];
    expect(targetDepthCall).toBeDefined();
    expect(targetDepthCall?.[0]).toBeCloseTo(12);
    expect(targetDepthCall?.[1]).toBeCloseTo(14.4);
    expect(targetDepthCall?.[2]).toBeCloseTo(6.0996);
    expect(targetDepthCall?.[3]).toBeCloseTo(3.4086);
  });

  it('paints buried bones with both bone and hole colors', () => {
    const ctx = createContextMock();

    paintBoardSprite(ctx, 'boxOnTarget', 0, 0, 24, palette, { rotationDegrees: 24 });

    expect(ctx.__fillStyles).toContain(palette.box);
    expect(ctx.__fillStyles).toContain(palette.boxOutline);
    expect(ctx.__fillStyles).toContain(palette.boxOnTarget);
    expect(ctx.__fillStyles).toContain(palette.target);
    expect(ctx.__fillStyles).not.toContain(palette.targetDepth);
    expect(ctx.rotate).toHaveBeenCalledWith((24 * Math.PI) / 180);
  });

  it('paints hedges and corgis with the expected palette accents', () => {
    const wallContext = createContextMock();
    paintBoardSprite(wallContext, 'wall', 0, 0, 24, palette);

    expect(wallContext.__fillStyles).toContain(palette.wall);
    expect(wallContext.__fillStyles).toContain(palette.wallShadow);
    expect(wallContext.__fillStyles).toContain(palette.wallHighlight);

    const corgiContext = createContextMock();
    paintBoardSprite(corgiContext, 'playerOnTarget', 0, 0, 24, palette);

    expect(corgiContext.__fillStyles).toContain(palette.playerFace);
    expect(corgiContext.__fillStyles).toContain(palette.playerCheek);
    expect(corgiContext.__fillStyles).toContain(palette.playerEarOuter);
    expect(corgiContext.__fillStyles).toContain(palette.targetDepth);
    expect(corgiContext.scale).toHaveBeenCalled();
    expect(corgiContext.quadraticCurveTo).toHaveBeenCalledWith(16, 27, 18.5, 24.5);
  });

  it('uses the dark favicon-style corgi colors in dark mode', () => {
    const darkPalette = resolveBoardPalette('classic', 'dark');
    const ctx = createContextMock();

    paintBoardSprite(ctx, 'player', 0, 0, 24, darkPalette);

    expect(ctx.__fillStyles).toContain(darkPalette.playerFace);
    expect(ctx.__fillStyles).toContain(darkPalette.playerEarInner);
    expect(ctx.__fillStyles).toContain(darkPalette.playerCheek);
  });

  it('renders the legacy skin with flat target and player colors', () => {
    const legacyPalette = resolveBoardPalette('legacy', 'light');
    const targetContext = createContextMock();
    paintBoardSprite(targetContext, 'target', 0, 0, 24, legacyPalette);

    expect(targetContext.__fillStyles).toContain(legacyPalette.target);
    expect(targetContext.__fillStyles).not.toContain(legacyPalette.targetDepth);

    const playerContext = createContextMock();
    paintBoardSprite(playerContext, 'player', 0, 0, 24, legacyPalette);

    expect(playerContext.__fillStyles).toContain(legacyPalette.player);
    expect(playerContext.__fillStyles).toContain(legacyPalette.playerLight);
    expect(playerContext.__fillStyles).toContain(legacyPalette.playerDark);
    expect(playerContext.__fillStyles).toContain(legacyPalette.playerPatch);
    expect(playerContext.__fillStyles).not.toContain('#f5e7b8');
  });

  it('paints classic unsolved bones and classic walls without requiring rotation options', () => {
    const boxContext = createContextMock();
    paintBoardSprite(boxContext, 'box', 0, 0, 24, palette);

    expect(boxContext.__fillStyles).toContain(palette.floor);
    expect(boxContext.__fillStyles).toContain(palette.box);
    expect(boxContext.__fillStyles).toContain(palette.boxOutline);
    expect(boxContext.rotate).toHaveBeenCalledWith(0);

    const wallContext = createContextMock();
    paintBoardSprite(wallContext, 'wall', 0, 0, 24, palette);

    expect(wallContext.__fillStyles).toContain(palette.wall);
    expect(wallContext.__fillStyles).toContain(palette.wallShadow);
    expect(wallContext.__fillStyles).toContain(palette.wallHighlight);
  });

  it('paints legacy wall, solved box, and solved player variants', () => {
    const legacyPalette = resolveBoardPalette('legacy', 'light');

    const wallContext = createContextMock();
    paintBoardSprite(wallContext, 'wall', 0, 0, 24, legacyPalette);
    expect(wallContext.__fillStyles).toEqual([
      legacyPalette.wall,
      legacyPalette.wallHighlight,
      legacyPalette.wallShadow,
    ]);

    const boxOnTargetContext = createContextMock();
    paintBoardSprite(boxOnTargetContext, 'boxOnTarget', 0, 0, 24, legacyPalette, {
      rotationDegrees: 12,
    });
    expect(boxOnTargetContext.__fillStyles).toContain(legacyPalette.boxOnTarget);
    expect(boxOnTargetContext.__fillStyles).toContain(legacyPalette.target);
    expect(boxOnTargetContext.rotate).toHaveBeenCalledWith((12 * Math.PI) / 180);

    const playerOnTargetContext = createContextMock();
    paintBoardSprite(playerOnTargetContext, 'playerOnTarget', 0, 0, 24, legacyPalette);
    expect(playerOnTargetContext.__fillStyles).toContain(legacyPalette.player);
    expect(playerOnTargetContext.__fillStyles).toContain(legacyPalette.targetShadow);
  });
});
