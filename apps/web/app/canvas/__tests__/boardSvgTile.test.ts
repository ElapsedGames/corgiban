import { describe, expect, it } from 'vitest';

import { resolveBoardPalette } from '../boardSkin';
import { renderBoardSvgTile } from '../boardSvgTile';

describe('boardSvgTile', () => {
  const palette = resolveBoardPalette('classic', 'light');

  it('renders a flat grass tile for floor cells', () => {
    const svg = renderBoardSvgTile('floor', palette, 64);

    expect(svg).toContain('width="64"');
    expect(svg).toContain(`fill="${palette.floor}"`);
    expect(svg).not.toContain(palette.target);
  });

  it('renders centered hole, bone, and corgi icon markup for interactive tiles', () => {
    const targetSvg = renderBoardSvgTile('target', palette, 64);
    const boxSvg = renderBoardSvgTile('box', palette, 64);
    const playerSvg = renderBoardSvgTile('player', palette, 64);

    expect(targetSvg).toContain(`fill="${palette.targetDepth}"`);
    expect(targetSvg).toContain('rx="25.415"');
    expect(targetSvg).toContain('ry="14.2025"');
    expect(boxSvg).toContain(`fill="${palette.box}"`);
    expect(boxSvg).toContain(`fill="${palette.boxOutline}"`);
    expect(playerSvg).toContain(`fill="${palette.playerFace}"`);
    expect(playerSvg).toContain(`fill="${palette.playerCheek}"`);
  });

  it('uses the dark favicon-style corgi markup in dark mode', () => {
    const darkPalette = resolveBoardPalette('classic', 'dark');
    const playerSvg = renderBoardSvgTile('player', darkPalette, 64);

    expect(playerSvg).toContain(`fill="${darkPalette.playerFace}"`);
    expect(playerSvg).toContain(`fill="${darkPalette.playerEarInner}"`);
    expect(playerSvg).toContain(`stroke="${darkPalette.playerMouth}"`);
  });

  it('renders the legacy skin with flat geometric symbols', () => {
    const legacyPalette = resolveBoardPalette('legacy', 'light');
    const targetSvg = renderBoardSvgTile('target', legacyPalette, 64);
    const playerSvg = renderBoardSvgTile('player', legacyPalette, 64);

    expect(targetSvg).toContain(`fill="${legacyPalette.target}"`);
    expect(targetSvg).not.toContain(`fill="${legacyPalette.targetDepth}"`);
    expect(playerSvg).toContain(`fill="${legacyPalette.player}"`);
    expect(playerSvg).not.toContain(`fill="${palette.playerFace}"`);
  });

  it('layers solved-state icons over the hole', () => {
    const boxOnTargetSvg = renderBoardSvgTile('boxOnTarget', palette, 64);
    const playerOnTargetSvg = renderBoardSvgTile('playerOnTarget', palette, 64);

    expect(boxOnTargetSvg).toContain(`fill="${palette.target}"`);
    expect(boxOnTargetSvg).toContain(`fill="${palette.boxOnTarget}"`);
    expect(playerOnTargetSvg).toContain(`fill="${palette.target}"`);
    expect(playerOnTargetSvg).toContain(`fill="${palette.playerFace}"`);
  });

  it('renders every classic sprite variant with a valid svg shell', () => {
    const kinds = [
      'floor',
      'wall',
      'target',
      'box',
      'boxOnTarget',
      'player',
      'playerOnTarget',
    ] as const;

    for (const kind of kinds) {
      const svg = renderBoardSvgTile(kind, palette, 48);

      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('height="48"');
      expect(svg).toContain('viewBox="0 0 100 100"');
      expect(svg).not.toContain('undefined');
    }
  });

  it('renders every legacy sprite variant with the expected flat wall and overlay markers', () => {
    const legacyPalette = resolveBoardPalette('legacy', 'light');
    const wallSvg = renderBoardSvgTile('wall', legacyPalette, 48);
    const boxOnTargetSvg = renderBoardSvgTile('boxOnTarget', legacyPalette, 48);
    const playerOnTargetSvg = renderBoardSvgTile('playerOnTarget', legacyPalette, 48);

    expect(wallSvg).toContain(`fill="${legacyPalette.wall}"`);
    expect(wallSvg).toContain(`fill="${legacyPalette.wallHighlight}"`);
    expect(wallSvg).toContain(`fill="${legacyPalette.wallShadow}"`);
    expect(boxOnTargetSvg).toContain(`fill="${legacyPalette.boxOnTarget}"`);
    expect(boxOnTargetSvg).toContain(`fill="${legacyPalette.target}"`);
    expect(playerOnTargetSvg).toContain(`fill="${legacyPalette.playerPatch}"`);
    expect(playerOnTargetSvg).toContain(`fill="${legacyPalette.targetShadow}"`);
  });
});
