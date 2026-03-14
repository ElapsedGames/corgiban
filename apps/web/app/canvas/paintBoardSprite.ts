import type { BoardPalette } from './boardSkin';
import type { SpriteKind } from './spriteAtlas.types';

type BoardSpriteContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type PaintBoardSpriteOptions = {
  rotationDegrees?: number;
};

function fillEllipse(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function paintGrass(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
): void {
  ctx.fillStyle = palette.floor;
  ctx.fillRect(x, y, cellSize, cellSize);
}

function paintLegacyTarget(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
): void {
  paintGrass(ctx, x, y, cellSize, palette);
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.5,
    cellSize * 0.2,
    cellSize * 0.2,
    palette.targetShadow,
  );
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.5,
    cellSize * 0.14,
    cellSize * 0.14,
    palette.floor,
  );
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.5,
    cellSize * 0.09,
    cellSize * 0.09,
    palette.target,
  );
}

function paintLegacyWall(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
): void {
  ctx.fillStyle = palette.wall;
  ctx.fillRect(x, y, cellSize, cellSize);
  ctx.fillStyle = palette.wallHighlight;
  ctx.fillRect(x, y, cellSize, cellSize * 0.02);
  ctx.fillStyle = palette.wallShadow;
  ctx.fillRect(x, y + cellSize * 0.96, cellSize, cellSize * 0.04);
}

function paintLegacyBoxShape(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  solved: boolean,
  rotationDegrees = 0,
): void {
  const angle = (rotationDegrees * Math.PI) / 180;
  const size = cellSize * 0.44;
  const centerX = x + cellSize * 0.5;
  const centerY = y + cellSize * 0.5;
  const fill = solved ? palette.boxOnTarget : palette.box;
  const shadow = solved ? palette.boxOnTargetShadow : palette.boxShadow;
  const accent = solved ? palette.boxOnTargetShadow : palette.boxOutline;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.fillStyle = shadow;
  ctx.fillRect(-size * 0.42, -size * 0.42, size, size);
  ctx.fillStyle = fill;
  ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
  ctx.fillStyle = accent;
  ctx.fillRect(-size * 0.34, -size * 0.34, size * 0.14, size * 0.14);
  ctx.restore();
}

function paintLegacyPlayer(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  onTarget: boolean,
): void {
  if (onTarget) {
    paintLegacyTarget(ctx, x, y, cellSize, palette);
  } else {
    paintGrass(ctx, x, y, cellSize, palette);
  }

  const centerX = x + cellSize * 0.5;
  const centerY = y + cellSize * 0.5;

  ctx.fillStyle = palette.playerDark;
  ctx.beginPath();
  ctx.moveTo(centerX, y + cellSize * 0.188);
  ctx.lineTo(x + cellSize * 0.812, centerY);
  ctx.lineTo(centerX, y + cellSize * 0.812);
  ctx.lineTo(x + cellSize * 0.188, centerY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.player;
  ctx.beginPath();
  ctx.moveTo(centerX, y + cellSize * 0.255);
  ctx.lineTo(x + cellSize * 0.745, centerY);
  ctx.lineTo(centerX, y + cellSize * 0.745);
  ctx.lineTo(x + cellSize * 0.255, centerY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.playerPatch;
  ctx.beginPath();
  ctx.moveTo(centerX, y + cellSize * 0.333);
  ctx.lineTo(x + cellSize * 0.667, centerY);
  ctx.lineTo(centerX, y + cellSize * 0.667);
  ctx.lineTo(x + cellSize * 0.333, centerY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.playerLight;
  ctx.beginPath();
  ctx.moveTo(centerX, y + cellSize * 0.294);
  ctx.lineTo(x + cellSize * 0.604, y + cellSize * 0.398);
  ctx.lineTo(centerX, y + cellSize * 0.502);
  ctx.lineTo(x + cellSize * 0.396, y + cellSize * 0.398);
  ctx.closePath();
  ctx.fill();
}

function paintHole(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
): void {
  paintGrass(ctx, x, y, cellSize, palette);

  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.58,
    cellSize * 0.345,
    cellSize * 0.2185,
    palette.targetShadow,
  );
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.56,
    cellSize * 0.299,
    cellSize * 0.184,
    palette.target,
  );
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.6,
    cellSize * 0.25415,
    cellSize * 0.142025,
    palette.targetDepth,
  );
}

function paintSolvedHole(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
): void {
  paintGrass(ctx, x, y, cellSize, palette);

  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.58,
    cellSize * 0.345,
    cellSize * 0.2185,
    palette.targetShadow,
  );
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.56,
    cellSize * 0.299,
    cellSize * 0.184,
    palette.target,
  );
}

function paintHedge(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
): void {
  ctx.fillStyle = palette.wallShadow;
  ctx.fillRect(x, y, cellSize, cellSize);
  ctx.fillStyle = palette.wall;
  ctx.fillRect(x + cellSize * 0.06, y + cellSize * 0.06, cellSize * 0.88, cellSize * 0.88);
  ctx.fillStyle = palette.wallHighlight;
  ctx.fillRect(x + cellSize * 0.06, y + cellSize * 0.06, cellSize * 0.88, cellSize * 0.08);
}

function paintBoneShape(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  buried: boolean,
  rotationDegrees = 0,
): void {
  const angle = (rotationDegrees * Math.PI) / 180;
  const shadowOffset = buried ? cellSize * 0.018 : cellSize * 0.024;
  const boneWidth = buried ? cellSize * 0.297 : cellSize * 0.414;
  const boneHeight = buried ? cellSize * 0.09 : cellSize * 0.1305;
  const centerX = x + cellSize * 0.5;
  const centerY = y + cellSize * (buried ? 0.5 : 0.525);
  const bodyX = -boneWidth / 2;
  const bodyY = -boneHeight / 2;
  const nubRadius = buried ? cellSize * 0.0585 : cellSize * 0.0765;
  const outlineRadius = buried ? cellSize * 0.012 : cellSize * 0.014;
  const outlineWidth = outlineRadius * 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);

  ctx.fillStyle = palette.boxShadow;
  ctx.fillRect(bodyX + shadowOffset, bodyY + shadowOffset, boneWidth, boneHeight);
  fillEllipse(
    ctx,
    bodyX + shadowOffset,
    -boneHeight * 0.3 + shadowOffset,
    nubRadius,
    nubRadius,
    palette.boxShadow,
  );
  fillEllipse(
    ctx,
    bodyX + shadowOffset,
    boneHeight * 0.3 + shadowOffset,
    nubRadius,
    nubRadius,
    palette.boxShadow,
  );
  fillEllipse(
    ctx,
    boneWidth / 2 + shadowOffset,
    -boneHeight * 0.3 + shadowOffset,
    nubRadius,
    nubRadius,
    palette.boxShadow,
  );
  fillEllipse(
    ctx,
    boneWidth / 2 + shadowOffset,
    boneHeight * 0.3 + shadowOffset,
    nubRadius,
    nubRadius,
    palette.boxShadow,
  );

  ctx.fillStyle = palette.boxOutline;
  ctx.fillRect(
    bodyX - outlineRadius,
    bodyY - outlineRadius,
    boneWidth + outlineWidth,
    boneHeight + outlineWidth,
  );
  fillEllipse(
    ctx,
    bodyX,
    -boneHeight * 0.3,
    nubRadius + outlineRadius,
    nubRadius + outlineRadius,
    palette.boxOutline,
  );
  fillEllipse(
    ctx,
    bodyX,
    boneHeight * 0.3,
    nubRadius + outlineRadius,
    nubRadius + outlineRadius,
    palette.boxOutline,
  );
  fillEllipse(
    ctx,
    boneWidth / 2,
    -boneHeight * 0.3,
    nubRadius + outlineRadius,
    nubRadius + outlineRadius,
    palette.boxOutline,
  );
  fillEllipse(
    ctx,
    boneWidth / 2,
    boneHeight * 0.3,
    nubRadius + outlineRadius,
    nubRadius + outlineRadius,
    palette.boxOutline,
  );

  ctx.fillStyle = palette.box;
  ctx.fillRect(bodyX, bodyY, boneWidth, boneHeight);
  fillEllipse(ctx, bodyX, -boneHeight * 0.3, nubRadius, nubRadius, palette.box);
  fillEllipse(ctx, bodyX, boneHeight * 0.3, nubRadius, nubRadius, palette.box);
  fillEllipse(ctx, boneWidth / 2, -boneHeight * 0.3, nubRadius, nubRadius, palette.box);
  fillEllipse(ctx, boneWidth / 2, boneHeight * 0.3, nubRadius, nubRadius, palette.box);

  if (buried) {
    fillEllipse(ctx, 0, cellSize * 0.07, cellSize * 0.155, cellSize * 0.078, palette.boxOnTarget);
  }

  ctx.restore();
}

function paintBone(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  rotationDegrees = 0,
): void {
  paintGrass(ctx, x, y, cellSize, palette);
  paintBoneShape(ctx, x, y, cellSize, palette, false, rotationDegrees);
}

function paintBuriedBone(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  rotationDegrees = 0,
): void {
  paintSolvedHole(ctx, x, y, cellSize, palette);
  paintBoneShape(ctx, x, y, cellSize, palette, true, rotationDegrees);
  fillEllipse(
    ctx,
    x + cellSize * 0.5,
    y + cellSize * 0.64,
    cellSize * 0.24725,
    cellSize * 0.138,
    palette.target,
  );
}

function paintCorgi(
  ctx: BoardSpriteContext,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  onTarget: boolean,
): void {
  if (onTarget) {
    paintHole(ctx, x, y, cellSize, palette);
  } else {
    paintGrass(ctx, x, y, cellSize, palette);
  }

  const iconScale = cellSize * 0.0254925;
  const originX = x + cellSize * 0.088;
  const originY = y + cellSize * 0.069;

  ctx.save();
  ctx.translate(originX, originY);
  ctx.scale(iconScale, iconScale);

  ctx.fillStyle = palette.playerEarOuter;
  ctx.beginPath();
  ctx.moveTo(5, 18);
  ctx.lineTo(1, 3);
  ctx.lineTo(13, 13);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(27, 18);
  ctx.lineTo(31, 3);
  ctx.lineTo(19, 13);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = palette.playerEarInner;
  ctx.beginPath();
  ctx.moveTo(6, 17);
  ctx.lineTo(3, 6);
  ctx.lineTo(12, 13);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(26, 17);
  ctx.lineTo(29, 6);
  ctx.lineTo(20, 13);
  ctx.closePath();
  ctx.fill();

  fillEllipse(ctx, 16, 20, 13, 11, palette.playerFace);

  if (palette.playerSpriteMode === 'dark') {
    fillEllipse(ctx, 11.5, 16.5, 3.5, 2.2, palette.playerEarInner);
    fillEllipse(ctx, 20.5, 16.5, 3.5, 2.2, palette.playerEarInner);
  }

  fillEllipse(ctx, 16, 24, 8, 6, palette.playerCheek);
  fillEllipse(ctx, 11.5, 18, 2.2, 2.2, palette.playerEye);
  fillEllipse(ctx, 12.2, 17.3, 0.7, 0.7, palette.playerEyeHighlight);
  fillEllipse(ctx, 20.5, 18, 2.2, 2.2, palette.playerEye);
  fillEllipse(ctx, 21.2, 17.3, 0.7, 0.7, palette.playerEyeHighlight);
  fillEllipse(ctx, 16, 22, 2.5, 1.8, palette.playerNose);

  ctx.strokeStyle = palette.playerMouth;
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(13.5, 24.5);
  ctx.quadraticCurveTo(16, 27, 18.5, 24.5);
  ctx.stroke();

  ctx.restore();
}

export function paintBoardSprite(
  ctx: BoardSpriteContext,
  kind: SpriteKind,
  x: number,
  y: number,
  cellSize: number,
  palette: BoardPalette,
  options: PaintBoardSpriteOptions = {},
): void {
  if (palette.visualStyle === 'legacy') {
    switch (kind) {
      case 'floor':
        paintGrass(ctx, x, y, cellSize, palette);
        return;
      case 'wall':
        paintLegacyWall(ctx, x, y, cellSize, palette);
        return;
      case 'target':
        paintLegacyTarget(ctx, x, y, cellSize, palette);
        return;
      case 'box':
        paintGrass(ctx, x, y, cellSize, palette);
        paintLegacyBoxShape(ctx, x, y, cellSize, palette, false, options.rotationDegrees);
        return;
      case 'boxOnTarget':
        paintLegacyTarget(ctx, x, y, cellSize, palette);
        paintLegacyBoxShape(ctx, x, y, cellSize, palette, true, options.rotationDegrees);
        return;
      case 'player':
        paintLegacyPlayer(ctx, x, y, cellSize, palette, false);
        return;
      case 'playerOnTarget':
        paintLegacyPlayer(ctx, x, y, cellSize, palette, true);
        return;
    }
  }

  switch (kind) {
    case 'floor':
      paintGrass(ctx, x, y, cellSize, palette);
      return;
    case 'wall':
      paintHedge(ctx, x, y, cellSize, palette);
      return;
    case 'target':
      paintHole(ctx, x, y, cellSize, palette);
      return;
    case 'box':
      paintBone(ctx, x, y, cellSize, palette, options.rotationDegrees);
      return;
    case 'boxOnTarget':
      paintBuriedBone(ctx, x, y, cellSize, palette, options.rotationDegrees);
      return;
    case 'player':
      paintCorgi(ctx, x, y, cellSize, palette, false);
      return;
    case 'playerOnTarget':
      paintCorgi(ctx, x, y, cellSize, palette, true);
      return;
  }
}
