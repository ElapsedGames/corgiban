import { describe, expect, it } from 'vitest';

import { builtinLevels } from '@corgiban/levels';

import { applyMoveSequence, gameSlice, move, nextLevel, restart, undo } from '../gameSlice';

describe('gameSlice', () => {
  it('returns the initial state', () => {
    const state = gameSlice.reducer(undefined, { type: 'unknown' });

    expect(state.levelId).toBe(builtinLevels[0].id);
    expect(state.history).toEqual([]);
    expect(state.stats).toEqual({ moves: 0, pushes: 0 });
  });

  it('records a move and updates stats', () => {
    let state = gameSlice.reducer(undefined, { type: 'unknown' });
    state = gameSlice.reducer(state, move({ direction: 'R' }));
    state = gameSlice.reducer(state, move({ direction: 'U', pushed: true }));

    expect(state.history).toEqual([
      { direction: 'R', pushed: false },
      { direction: 'U', pushed: true },
    ]);
    expect(state.stats).toEqual({ moves: 2, pushes: 1 });
  });

  it('ignores moves flagged as unchanged', () => {
    let state = gameSlice.reducer(undefined, { type: 'unknown' });
    state = gameSlice.reducer(state, move({ direction: 'L', changed: false }));

    expect(state.history).toEqual([]);
    expect(state.stats).toEqual({ moves: 0, pushes: 0 });
  });

  it('undoes the last move', () => {
    let state = gameSlice.reducer(undefined, { type: 'unknown' });
    state = gameSlice.reducer(state, move({ direction: 'R' }));
    state = gameSlice.reducer(state, move({ direction: 'U', pushed: true }));
    state = gameSlice.reducer(state, undo());

    expect(state.history).toEqual([{ direction: 'R', pushed: false }]);
    expect(state.stats).toEqual({ moves: 1, pushes: 0 });
  });

  it('applies a sequence of moves in one action', () => {
    let state = gameSlice.reducer(undefined, { type: 'unknown' });
    state = gameSlice.reducer(
      state,
      applyMoveSequence({
        moves: [
          { direction: 'L', pushed: false },
          { direction: 'D', pushed: true },
        ],
      }),
    );

    expect(state.history).toEqual([
      { direction: 'L', pushed: false },
      { direction: 'D', pushed: true },
    ]);
    expect(state.stats).toEqual({ moves: 2, pushes: 1 });
  });

  it('ignores empty move sequences', () => {
    const initial = gameSlice.reducer(undefined, { type: 'unknown' });
    const state = gameSlice.reducer(initial, applyMoveSequence({ moves: [] }));

    expect(state).toEqual(initial);
  });

  it('ignores undo when there is no history', () => {
    const initial = gameSlice.reducer(undefined, { type: 'unknown' });
    const state = gameSlice.reducer(initial, undo());

    expect(state).toEqual(initial);
  });

  it('handles missing history entries defensively', () => {
    const state = gameSlice.reducer(undefined, { type: 'unknown' });
    const corrupted = {
      ...state,
      history: [undefined as unknown as (typeof state.history)[number]],
      stats: { moves: 1, pushes: 1 },
    };

    const next = gameSlice.reducer(corrupted, undo());

    expect(next.history).toEqual([]);
    expect(next.stats).toEqual({ moves: 1, pushes: 1 });
  });

  it('restarts the current level', () => {
    let state = gameSlice.reducer(undefined, { type: 'unknown' });
    state = gameSlice.reducer(state, move({ direction: 'R' }));
    state = gameSlice.reducer(state, restart());

    expect(state.history).toEqual([]);
    expect(state.stats).toEqual({ moves: 0, pushes: 0 });
    expect(state.levelId).toBe(builtinLevels[0].id);
  });

  it('switches to the next level and resets history', () => {
    let state = gameSlice.reducer(undefined, { type: 'unknown' });
    state = gameSlice.reducer(state, move({ direction: 'R', pushed: true }));
    state = gameSlice.reducer(state, nextLevel({ levelId: 'core-002' }));

    expect(state.levelId).toBe('core-002');
    expect(state.history).toEqual([]);
    expect(state.stats).toEqual({ moves: 0, pushes: 0 });
  });
});
