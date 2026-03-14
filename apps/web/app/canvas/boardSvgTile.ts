import type { BoardPalette } from './boardSkin';
import type { SpriteKind } from './spriteAtlas.types';

const SVG_VIEWBOX = '0 0 100 100';

function svg(parts: string[], pixelSize: number): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelSize}" height="${pixelSize}" viewBox="${SVG_VIEWBOX}" shape-rendering="geometricPrecision">`,
    ...parts,
    '</svg>',
  ].join('');
}

function renderGrassBackground(palette: BoardPalette): string {
  return `<rect width="100" height="100" fill="${palette.floor}"/>`;
}

function renderLegacyWallTile(palette: BoardPalette): string[] {
  return [
    `<rect width="100" height="100" fill="${palette.wall}"/>`,
    `<rect y="0" width="100" height="2" fill="${palette.wallHighlight}"/>`,
    `<rect y="96" width="100" height="4" fill="${palette.wallShadow}"/>`,
  ];
}

function renderLegacyTargetIcon(palette: BoardPalette): string {
  return [
    `<circle cx="50" cy="50" r="20" fill="${palette.targetShadow}"/>`,
    `<circle cx="50" cy="50" r="14" fill="${palette.floor}"/>`,
    `<circle cx="50" cy="50" r="9" fill="${palette.target}"/>`,
  ].join('');
}

function renderLegacyBoxIcon(palette: BoardPalette, solved: boolean): string {
  const fill = solved ? palette.boxOnTarget : palette.box;
  const shadow = solved ? palette.boxOnTargetShadow : palette.boxShadow;
  const accent = solved ? palette.boxOnTargetShadow : palette.boxOutline;
  return [
    `<rect x="28" y="28" width="44" height="44" rx="6" fill="${shadow}"/>`,
    `<rect x="24" y="24" width="44" height="44" rx="6" fill="${fill}"/>`,
    `<rect x="31" y="31" width="6" height="6" rx="1.5" fill="${accent}"/>`,
  ].join('');
}

function renderLegacyPlayerIcon(palette: BoardPalette): string {
  return [
    `<path d="M50 19 L81 50 L50 81 L19 50 Z" fill="${palette.playerDark}"/>`,
    `<path d="M50 25.5 L74.5 50 L50 74.5 L25.5 50 Z" fill="${palette.player}"/>`,
    `<path d="M50 33.3 L66.7 50 L50 66.7 L33.3 50 Z" fill="${palette.playerPatch}"/>`,
    `<path d="M50 29.4 L60.4 39.8 L50 50.2 L39.6 39.8 Z" fill="${palette.playerLight}"/>`,
  ].join('');
}

function renderWallTile(palette: BoardPalette): string[] {
  return [
    `<rect width="100" height="100" fill="${palette.wallShadow}"/>`,
    `<rect x="6" y="6" width="88" height="88" fill="${palette.wall}" rx="2"/>`,
    `<rect x="6" y="6" width="88" height="8" fill="${palette.wallHighlight}" rx="2"/>`,
  ];
}

function renderHoleIcon(palette: BoardPalette): string {
  return [
    `<ellipse cx="50" cy="58" rx="34.5" ry="21.85" fill="${palette.targetShadow}"/>`,
    `<ellipse cx="50" cy="56" rx="29.9" ry="18.4" fill="${palette.target}"/>`,
    `<ellipse cx="50" cy="60" rx="25.415" ry="14.2025" fill="${palette.targetDepth}"/>`,
  ].join('');
}

function renderSolvedHoleIcon(palette: BoardPalette): string {
  return [
    `<ellipse cx="50" cy="58" rx="34.5" ry="21.85" fill="${palette.targetShadow}"/>`,
    `<ellipse cx="50" cy="56" rx="29.9" ry="18.4" fill="${palette.target}"/>`,
  ].join('');
}

function renderHoleFrontCover(palette: BoardPalette): string {
  return `<ellipse cx="50" cy="64" rx="24.725" ry="13.8" fill="${palette.target}"/>`;
}

function renderBoneIcon(palette: BoardPalette, buried: boolean): string {
  const bodyWidth = buried ? 29.7 : 41.4;
  const bodyHeight = buried ? 9 : 13.05;
  const bodyX = 50 - bodyWidth / 2;
  const bodyY = buried ? 45.5 : 46.7;
  const nubRadius = buried ? 5.85 : 7.65;
  const leftX = bodyX;
  const rightX = bodyX + bodyWidth;
  const topY = bodyY + bodyHeight * 0.3;
  const bottomY = bodyY + bodyHeight * 0.7;
  const outlineWidth = buried ? 2.2 : 2.6;

  return [
    `<g>`,
    `<rect x="${bodyX + 2.4}" y="${bodyY + 2.4}" width="${bodyWidth}" height="${bodyHeight}" rx="4" fill="${palette.boxShadow}"/>`,
    `<circle cx="${leftX + 1.8}" cy="${topY + 1.8}" r="${nubRadius}" fill="${palette.boxShadow}"/>`,
    `<circle cx="${leftX + 1.8}" cy="${bottomY + 1.8}" r="${nubRadius}" fill="${palette.boxShadow}"/>`,
    `<circle cx="${rightX + 1.8}" cy="${topY + 1.8}" r="${nubRadius}" fill="${palette.boxShadow}"/>`,
    `<circle cx="${rightX + 1.8}" cy="${bottomY + 1.8}" r="${nubRadius}" fill="${palette.boxShadow}"/>`,
    `<rect x="${bodyX - outlineWidth / 2}" y="${bodyY - outlineWidth / 2}" width="${bodyWidth + outlineWidth}" height="${bodyHeight + outlineWidth}" rx="4.5" fill="${palette.boxOutline}"/>`,
    `<circle cx="${leftX}" cy="${topY}" r="${nubRadius + outlineWidth / 2}" fill="${palette.boxOutline}"/>`,
    `<circle cx="${leftX}" cy="${bottomY}" r="${nubRadius + outlineWidth / 2}" fill="${palette.boxOutline}"/>`,
    `<circle cx="${rightX}" cy="${topY}" r="${nubRadius + outlineWidth / 2}" fill="${palette.boxOutline}"/>`,
    `<circle cx="${rightX}" cy="${bottomY}" r="${nubRadius + outlineWidth / 2}" fill="${palette.boxOutline}"/>`,
    `<rect x="${bodyX}" y="${bodyY}" width="${bodyWidth}" height="${bodyHeight}" rx="4" fill="${palette.box}"/>`,
    `<circle cx="${leftX}" cy="${topY}" r="${nubRadius}" fill="${palette.box}"/>`,
    `<circle cx="${leftX}" cy="${bottomY}" r="${nubRadius}" fill="${palette.box}"/>`,
    `<circle cx="${rightX}" cy="${topY}" r="${nubRadius}" fill="${palette.box}"/>`,
    `<circle cx="${rightX}" cy="${bottomY}" r="${nubRadius}" fill="${palette.box}"/>`,
    buried ? `<ellipse cx="50" cy="57" rx="15.5" ry="7.8" fill="${palette.boxOnTarget}"/>` : '',
    `</g>`,
  ].join('');
}

function renderCorgiIcon(palette: BoardPalette): string {
  return [
    `<g transform="translate(8.8 6.9) scale(2.54925)">`,
    `<path d="M5 18 L1 3 L13 13 Z" fill="${palette.playerEarOuter}"/>`,
    `<path d="M27 18 L31 3 L19 13 Z" fill="${palette.playerEarOuter}"/>`,
    `<path d="M6 17 L3 6 L12 13 Z" fill="${palette.playerEarInner}"/>`,
    `<path d="M26 17 L29 6 L20 13 Z" fill="${palette.playerEarInner}"/>`,
    `<ellipse cx="16" cy="20" rx="13" ry="11" fill="${palette.playerFace}"/>`,
    palette.playerSpriteMode === 'dark'
      ? `<ellipse cx="11.5" cy="16.5" rx="3.5" ry="2.2" fill="${palette.playerEarInner}"/>`
      : '',
    palette.playerSpriteMode === 'dark'
      ? `<ellipse cx="20.5" cy="16.5" rx="3.5" ry="2.2" fill="${palette.playerEarInner}"/>`
      : '',
    `<ellipse cx="16" cy="24" rx="8" ry="6" fill="${palette.playerCheek}"/>`,
    `<circle cx="11.5" cy="18" r="2.2" fill="${palette.playerEye}"/>`,
    `<circle cx="12.2" cy="17.3" r="0.7" fill="${palette.playerEyeHighlight}"/>`,
    `<circle cx="20.5" cy="18" r="2.2" fill="${palette.playerEye}"/>`,
    `<circle cx="21.2" cy="17.3" r="0.7" fill="${palette.playerEyeHighlight}"/>`,
    `<ellipse cx="16" cy="22" rx="2.5" ry="1.8" fill="${palette.playerNose}"/>`,
    `<path d="M13.5 24.5 Q16 27 18.5 24.5" stroke="${palette.playerMouth}" stroke-width="0.9" fill="none" stroke-linecap="round"/>`,
    `</g>`,
  ].join('');
}

export function renderBoardSvgTile(
  kind: SpriteKind,
  palette: BoardPalette,
  pixelSize: number,
): string {
  if (palette.visualStyle === 'legacy') {
    switch (kind) {
      case 'floor':
        return svg([renderGrassBackground(palette)], pixelSize);
      case 'wall':
        return svg(renderLegacyWallTile(palette), pixelSize);
      case 'target':
        return svg([renderGrassBackground(palette), renderLegacyTargetIcon(palette)], pixelSize);
      case 'box':
        return svg(
          [renderGrassBackground(palette), renderLegacyBoxIcon(palette, false)],
          pixelSize,
        );
      case 'boxOnTarget':
        return svg(
          [
            renderGrassBackground(palette),
            renderLegacyTargetIcon(palette),
            renderLegacyBoxIcon(palette, true),
          ],
          pixelSize,
        );
      case 'player':
        return svg([renderGrassBackground(palette), renderLegacyPlayerIcon(palette)], pixelSize);
      case 'playerOnTarget':
        return svg(
          [
            renderGrassBackground(palette),
            renderLegacyTargetIcon(palette),
            renderLegacyPlayerIcon(palette),
          ],
          pixelSize,
        );
    }
  }

  switch (kind) {
    case 'floor':
      return svg([renderGrassBackground(palette)], pixelSize);
    case 'wall':
      return svg(renderWallTile(palette), pixelSize);
    case 'target':
      return svg([renderGrassBackground(palette), renderHoleIcon(palette)], pixelSize);
    case 'box':
      return svg([renderGrassBackground(palette), renderBoneIcon(palette, false)], pixelSize);
    case 'boxOnTarget':
      return svg(
        [
          renderGrassBackground(palette),
          renderSolvedHoleIcon(palette),
          renderBoneIcon(palette, true),
          renderHoleFrontCover(palette),
        ],
        pixelSize,
      );
    case 'player':
      return svg([renderGrassBackground(palette), renderCorgiIcon(palette)], pixelSize);
    case 'playerOnTarget':
      return svg(
        [renderGrassBackground(palette), renderHoleIcon(palette), renderCorgiIcon(palette)],
        pixelSize,
      );
  }
}
