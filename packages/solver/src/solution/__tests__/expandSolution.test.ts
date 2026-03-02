import { describe, expect, it } from 'vitest';

import type { LevelRuntime } from '@corgiban/core';
import { applyMove, createGame, parseLevel } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { directionsToString, expandSolutionFromStart } from '../expandSolution';
import type { Push } from '../../api/solverTypes';

function buildLevel(rows: string[]): LevelRuntime {
  return parseLevel({ id: 'test-level', name: 'Test Level', rows });
}

function applyMoves(level: LevelRuntime, moves: Direction[]): number {
  let state = createGame(level);
  for (const move of moves) {
    state = applyMove(state, move).state;
  }
  return state.playerIndex;
}

describe('expandSolution', () => {
  it('expands a push with deterministic walk path ordering', () => {
    const level = buildLevel(['WWWWW', 'WEEEW', 'WPBEW', 'WEEEW', 'WWWWW']);

    const push: Push = {
      boxIndex: level.initialBoxes[0],
      direction: 'U',
    };

    const moves = expandSolutionFromStart(level, [push]);

    expect(moves).toEqual(['D', 'R', 'U']);
    expect(applyMoves(level, moves)).toBe(level.initialBoxes[0]);
  });

  it('updates box positions between pushes', () => {
    const level = buildLevel(['WWWWWWW', 'WPBEEEW', 'WWWWWWW']);
    const firstBoxIndex = level.initialBoxes[0];

    const pushes: Push[] = [
      { boxIndex: firstBoxIndex, direction: 'R' },
      { boxIndex: firstBoxIndex + 1, direction: 'R' },
    ];

    const moves = expandSolutionFromStart(level, pushes);

    expect(moves).toEqual(['R', 'R']);
  });

  it('returns empty moves for zero pushes', () => {
    const level = buildLevel(['WWWW', 'WPEW', 'WWWW']);

    expect(expandSolutionFromStart(level, [])).toEqual([]);
  });

  it('throws when a push references a missing box', () => {
    const level = buildLevel(['WPW']);
    const pushes: Push[] = [{ boxIndex: 99, direction: 'R' }];

    expect(() => expandSolutionFromStart(level, pushes)).toThrow('missing box');
  });

  it('throws when the push entry cell is out of bounds', () => {
    const level = buildLevel(['B', 'P']);
    const push: Push = { boxIndex: level.initialBoxes[0], direction: 'D' };

    expect(() => expandSolutionFromStart(level, [push])).toThrow('out of bounds');
  });

  it('throws when no walk path exists to the push entry cell', () => {
    const level = buildLevel(['WWWWW', 'WPWEW', 'WBWEW', 'WWWWW']);
    const push: Push = { boxIndex: level.initialBoxes[0], direction: 'R' };

    expect(() => expandSolutionFromStart(level, [push])).toThrow('No walk path found');
  });

  it('throws when a push moves into another box', () => {
    const level = buildLevel(['WPBBE']);
    const push: Push = { boxIndex: level.initialBoxes[0], direction: 'R' };

    expect(() => expandSolutionFromStart(level, [push])).toThrow('occupied cell');
  });

  it('throws when a push moves into a wall', () => {
    const level = buildLevel(['WPBW']);
    const push: Push = { boxIndex: level.initialBoxes[0], direction: 'R' };

    expect(() => expandSolutionFromStart(level, [push])).toThrow('into a wall');
  });

  it('joins directions into a string', () => {
    expect(directionsToString(['U', 'D', 'L', 'R'])).toBe('UDLR');
  });
});
