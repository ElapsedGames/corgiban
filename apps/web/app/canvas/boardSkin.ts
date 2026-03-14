import type { AppTheme } from '../theme/theme';

export type BoardRenderMode = AppTheme;

export const BOARD_SKIN_IDS = ['legacy', 'classic'] as const;

export type BoardSkinId = (typeof BOARD_SKIN_IDS)[number];
export type BoardVisualStyle = 'legacy' | 'themed';
export type BoxRotationMode = 'none' | 'cell-hash';
export type GridLineMode = 'off' | 'subtle' | 'on';

export type BoardPalette = {
  visualStyle: BoardVisualStyle;
  boxRotationMode: BoxRotationMode;
  gridLineMode: GridLineMode;
  playerSpriteMode: BoardRenderMode;
  background: string;
  floor: string;
  floorShadow: string;
  floorHighlight: string;
  wall: string;
  wallShadow: string;
  wallHighlight: string;
  target: string;
  targetDepth: string;
  targetShadow: string;
  box: string;
  boxOutline: string;
  boxShadow: string;
  boxOnTarget: string;
  boxOnTargetShadow: string;
  player: string;
  playerPatch: string;
  playerDark: string;
  playerLight: string;
  playerEarOuter: string;
  playerEarInner: string;
  playerFace: string;
  playerCheek: string;
  playerEye: string;
  playerEyeHighlight: string;
  playerNose: string;
  playerMouth: string;
  grid: string;
  gridStrong: string;
};

export const DEFAULT_BOARD_SKIN_ID: BoardSkinId = 'classic';
export const DEFAULT_BOARD_RENDER_MODE: BoardRenderMode = 'dark';

const boardSkins: Record<BoardSkinId, Record<BoardRenderMode, BoardPalette>> = {
  legacy: {
    light: {
      visualStyle: 'legacy',
      boxRotationMode: 'none',
      gridLineMode: 'on',
      playerSpriteMode: 'light',
      background: '#e2e8f0',
      floor: '#cbd5e1',
      floorShadow: '#94a3b8',
      floorHighlight: '#f8fafc',
      wall: '#94a3b8',
      wallShadow: '#64748b',
      wallHighlight: '#cbd5e1',
      target: '#eab308',
      targetDepth: '#fef3c7',
      targetShadow: '#a16207',
      box: '#2563eb',
      boxOutline: '#1d4ed8',
      boxShadow: '#1e40af',
      boxOnTarget: '#16a34a',
      boxOnTargetShadow: '#166534',
      player: '#ff8a65',
      playerPatch: '#e76f51',
      playerDark: '#6b2d1f',
      playerLight: '#ffd0c2',
      playerEarOuter: '#ff8a65',
      playerEarInner: '#ffd0c2',
      playerFace: '#ff8a65',
      playerCheek: '#ffd0c2',
      playerEye: '#6b2d1f',
      playerEyeHighlight: '#f8fafc',
      playerNose: '#6b2d1f',
      playerMouth: '#6b2d1f',
      grid: 'rgba(71, 85, 105, 0.2)',
      gridStrong: '#64748b',
    },
    dark: {
      visualStyle: 'legacy',
      boxRotationMode: 'none',
      gridLineMode: 'on',
      playerSpriteMode: 'dark',
      background: '#0a1020',
      floor: '#263449',
      floorShadow: '#182132',
      floorHighlight: '#41536d',
      wall: '#162033',
      wallShadow: '#09111d',
      wallHighlight: '#3d506b',
      target: '#facc15',
      targetDepth: '#fef08a',
      targetShadow: '#ca8a04',
      box: '#60a5fa',
      boxOutline: '#3b82f6',
      boxShadow: '#1d4ed8',
      boxOnTarget: '#22c55e',
      boxOnTargetShadow: '#15803d',
      player: '#ff8a65',
      playerPatch: '#e76f51',
      playerDark: '#6b2d1f',
      playerLight: '#ffd0c2',
      playerEarOuter: '#ff8a65',
      playerEarInner: '#ffd0c2',
      playerFace: '#ff8a65',
      playerCheek: '#ffd0c2',
      playerEye: '#6b2d1f',
      playerEyeHighlight: '#f8fafc',
      playerNose: '#6b2d1f',
      playerMouth: '#6b2d1f',
      grid: 'rgba(148, 163, 184, 0.15)',
      gridStrong: '#5a6d87',
    },
  },
  classic: {
    light: {
      visualStyle: 'themed',
      boxRotationMode: 'cell-hash',
      gridLineMode: 'subtle',
      playerSpriteMode: 'light',
      background: '#d8ebc1',
      floor: '#78ba52',
      floorShadow: '#508236',
      floorHighlight: '#b6df7f',
      wall: '#5b626d',
      wallShadow: '#434a55',
      wallHighlight: '#8b93a1',
      target: '#7b4b26',
      targetDepth: '#362012',
      targetShadow: '#4d2d18',
      box: '#f2e2b8',
      boxOutline: '#8b6a3c',
      boxShadow: '#c5a56d',
      boxOnTarget: '#8d582e',
      boxOnTargetShadow: '#6b4222',
      player: '#d58a45',
      playerPatch: '#b96a2e',
      playerDark: '#24150c',
      playerLight: '#f5ddb0',
      playerEarOuter: '#b8692a',
      playerEarInner: '#e8a87c',
      playerFace: '#d4884a',
      playerCheek: '#f2d6a0',
      playerEye: '#1a0d00',
      playerEyeHighlight: '#ffffff',
      playerNose: '#1a0d00',
      playerMouth: '#9b6030',
      grid: 'rgba(43, 73, 31, 0.18)',
      gridStrong: '#2b491f',
    },
    dark: {
      visualStyle: 'themed',
      boxRotationMode: 'cell-hash',
      gridLineMode: 'subtle',
      playerSpriteMode: 'dark',
      background: '#0b1d0f',
      floor: '#295931',
      floorShadow: '#17331c',
      floorHighlight: '#4b9f55',
      wall: '#2d3238',
      wallShadow: '#171b1f',
      wallHighlight: '#5c6570',
      target: '#8e5c2f',
      targetDepth: '#24130a',
      targetShadow: '#4a2c17',
      box: '#ebd7aa',
      boxOutline: '#6f5228',
      boxShadow: '#b79258',
      boxOnTarget: '#6b4222',
      boxOnTargetShadow: '#4a2c17',
      player: '#d59050',
      playerPatch: '#242424',
      playerDark: '#130b06',
      playerLight: '#f0e6d8',
      playerEarOuter: '#1a1a1a',
      playerEarInner: '#c4875a',
      playerFace: '#2a2a2a',
      playerCheek: '#f0ebe4',
      playerEye: '#1a0d00',
      playerEyeHighlight: '#ffffff',
      playerNose: '#1a0d00',
      playerMouth: '#8a7060',
      grid: 'rgba(168, 210, 149, 0.12)',
      gridStrong: '#4e8d46',
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
