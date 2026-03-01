export type FloorType = 'floor' | 'target';
export type Occupant = 'empty' | 'box' | 'player';

export type Cell = { kind: 'wall' } | { kind: 'open'; floor: FloorType; occupant: Occupant };

export const STATIC_WALL = 0;
export const STATIC_FLOOR = 1;
export const STATIC_TARGET = 2;

export function isWall(cell: number): boolean {
  return cell === STATIC_WALL;
}

export function isTarget(cell: number): boolean {
  return cell === STATIC_TARGET;
}

export function isFloor(cell: number): boolean {
  return cell === STATIC_FLOOR || cell === STATIC_TARGET;
}
