import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BOARD_RENDER_MODE,
  DEFAULT_BOARD_SKIN_ID,
  BOARD_SKIN_IDS,
  isBoardRenderMode,
  isBoardSkinId,
  makeBoardSkinKey,
  resolveBoardPalette,
} from '../boardSkin';

describe('boardSkin', () => {
  it('keeps classic as the renderer default and also exposes the legacy skin', () => {
    expect(DEFAULT_BOARD_SKIN_ID).toBe('classic');
    expect(DEFAULT_BOARD_RENDER_MODE).toBe('dark');
    expect(BOARD_SKIN_IDS).toContain('legacy');
    expect(BOARD_SKIN_IDS).toContain('classic');
  });

  it('recognizes supported board skin ids and modes', () => {
    expect(isBoardSkinId('legacy')).toBe(true);
    expect(isBoardSkinId('classic')).toBe(true);
    expect(isBoardSkinId('future')).toBe(false);
    expect(isBoardRenderMode('light')).toBe(true);
    expect(isBoardRenderMode('dark')).toBe(true);
    expect(isBoardRenderMode('sepia')).toBe(false);
  });

  it('resolves distinct palettes for legacy and themed skins', () => {
    const legacyDark = resolveBoardPalette('legacy', 'dark');
    const legacyLight = resolveBoardPalette('legacy', 'light');
    const dark = resolveBoardPalette('classic', 'dark');
    const light = resolveBoardPalette('classic', 'light');

    expect(legacyDark.visualStyle).toBe('legacy');
    expect(legacyDark.boxRotationMode).toBe('none');
    expect(legacyDark.gridLineMode).toBe('on');
    expect(legacyLight.wall).toBe('#94a3b8');
    expect(legacyDark.floor).toBe('#263449');
    expect(legacyLight.target).toBe('#eab308');
    expect(legacyDark.box).toBe('#60a5fa');
    expect(legacyDark.boxOnTarget).toBe('#22c55e');
    expect(legacyDark.player).toBe('#ff8a65');
    expect(legacyDark.playerDark).toBe('#6b2d1f');
    expect(dark.wall).toBe('#2d3238');
    expect(dark.floor).toBe('#295931');
    expect(dark.visualStyle).toBe('themed');
    expect(dark.boxRotationMode).toBe('cell-hash');
    expect(dark.gridLineMode).toBe('subtle');
    expect(light.wall).toBe('#5b626d');
    expect(light.floor).toBe('#78ba52');
    expect(light.targetDepth).toBe('#362012');
    expect(light.playerSpriteMode).toBe('light');
    expect(dark.playerSpriteMode).toBe('dark');
    expect(dark.playerPatch).toBe('#242424');
    expect(light.wall).not.toBe(dark.wall);
  });

  it('builds skin-aware cache keys for atlas requests', () => {
    expect(makeBoardSkinKey('legacy', 'dark', 16, 2)).toBe('legacy:dark:16:2');
    expect(makeBoardSkinKey('classic', 'dark', 16, 2)).toBe('classic:dark:16:2');
    expect(makeBoardSkinKey('classic', 'light', 24, 1)).toBe('classic:light:24:1');
  });
});
