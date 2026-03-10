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
  it('exposes the classic skin as the default procedural skin', () => {
    expect(DEFAULT_BOARD_SKIN_ID).toBe('classic');
    expect(DEFAULT_BOARD_RENDER_MODE).toBe('dark');
    expect(BOARD_SKIN_IDS).toContain('classic');
  });

  it('recognizes supported board skin ids and modes', () => {
    expect(isBoardSkinId('classic')).toBe(true);
    expect(isBoardSkinId('future')).toBe(false);
    expect(isBoardRenderMode('light')).toBe(true);
    expect(isBoardRenderMode('dark')).toBe(true);
    expect(isBoardRenderMode('sepia')).toBe(false);
  });

  it('resolves distinct palettes for light and dark mode', () => {
    const dark = resolveBoardPalette('classic', 'dark');
    const light = resolveBoardPalette('classic', 'light');

    expect(dark.wall).toBe('#020617');
    expect(dark.floor).toBe('#1f2937');
    expect(light.wall).toBe('#94a3b8');
    expect(light.floor).toBe('#cbd5e1');
    expect(light.wall).not.toBe(dark.wall);
  });

  it('builds skin-aware cache keys for atlas requests', () => {
    expect(makeBoardSkinKey('classic', 'dark', 16, 2)).toBe('classic:dark:16:2');
    expect(makeBoardSkinKey('classic', 'light', 24, 1)).toBe('classic:light:24:1');
  });
});
