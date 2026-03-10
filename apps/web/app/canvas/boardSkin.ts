import type { AppTheme } from '../theme/theme';

export type BoardRenderMode = AppTheme;

export const BOARD_SKIN_IDS = ['classic'] as const;

export type BoardSkinId = (typeof BOARD_SKIN_IDS)[number];

export type BoardPalette = {
  background: string;
  floor: string;
  wall: string;
  target: string;
  box: string;
  boxOnTarget: string;
  player: string;
  grid: string;
};

export const DEFAULT_BOARD_SKIN_ID: BoardSkinId = 'classic';
export const DEFAULT_BOARD_RENDER_MODE: BoardRenderMode = 'dark';

const boardSkins: Record<BoardSkinId, Record<BoardRenderMode, BoardPalette>> = {
  classic: {
    light: {
      background: '#e2e8f0',
      floor: '#cbd5e1',
      wall: '#94a3b8',
      target: '#0284c7',
      box: '#d97706',
      boxOnTarget: '#16a34a',
      player: '#2563eb',
      grid: 'rgba(71, 85, 105, 0.2)',
    },
    dark: {
      background: '#0b1120',
      floor: '#1f2937',
      wall: '#020617',
      target: '#22d3ee',
      box: '#f59e0b',
      boxOnTarget: '#22c55e',
      player: '#38bdf8',
      grid: 'rgba(148, 163, 184, 0.15)',
    },
  },
};

export function isBoardSkinId(value: unknown): value is BoardSkinId {
  return typeof value === 'string' && BOARD_SKIN_IDS.includes(value as BoardSkinId);
}

export function isBoardRenderMode(value: unknown): value is BoardRenderMode {
  return value === 'light' || value === 'dark';
}

export function resolveBoardPalette(
  skinId: BoardSkinId = DEFAULT_BOARD_SKIN_ID,
  mode: BoardRenderMode,
): BoardPalette {
  return boardSkins[skinId]?.[mode] ?? boardSkins[DEFAULT_BOARD_SKIN_ID][mode];
}

export function makeBoardSkinKey(
  skinId: BoardSkinId = DEFAULT_BOARD_SKIN_ID,
  mode: BoardRenderMode = DEFAULT_BOARD_RENDER_MODE,
  cellSize: number,
  dpr: number,
): string {
  return `${skinId}:${mode}:${cellSize}:${dpr}`;
}
