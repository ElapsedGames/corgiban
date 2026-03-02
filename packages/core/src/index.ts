export const coreVersion = '0.0.0';

export type { Cell, FloorType, Occupant } from './model/cell';
export { isWall } from './model/cell';
export type { LevelRuntime } from './model/level';
export type { GameState } from './model/gameState';
export type { Direction } from '@corgiban/shared';
export type Position = { row: number; col: number };

export { createGame } from './model/gameState';
export { applyMove } from './engine/applyMove';
export { undo } from './engine/undo';
export { restart } from './engine/restart';
export { isWin } from './engine/rules';
export { parseLevel } from './encoding/parseLevel';
export { serializeLevel } from './encoding/serializeLevel';
export { normalize } from './hashing/normalize';
export { hash } from './hashing/hash';
