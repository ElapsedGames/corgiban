import type { LevelRuntime } from './level';

export interface HistoryEntry {
  prevPlayerIndex: number;
  movedBoxFrom?: number;
  movedBoxTo?: number;
  pushed: boolean;
}

export interface GameStats {
  moves: number;
  pushes: number;
}

export interface GameState {
  level: LevelRuntime;
  playerIndex: number;
  boxes: Uint32Array;
  history: HistoryEntry[];
  stats: GameStats;
}

export function createGame(level: LevelRuntime): GameState {
  return {
    level,
    playerIndex: level.initialPlayerIndex,
    boxes: new Uint32Array(level.initialBoxes),
    history: [],
    stats: { moves: 0, pushes: 0 },
  };
}
