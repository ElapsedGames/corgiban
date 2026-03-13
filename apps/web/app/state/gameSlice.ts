import { createSlice } from '@reduxjs/toolkit';

import type { Direction } from '@corgiban/shared';
import { builtinLevels } from '@corgiban/levels';

import { createPlayableExactLevelKey } from '../levels/playableIdentity';
import { toBuiltinLevelRef } from '../levels/temporaryLevelCatalog';

export type GameMove = {
  direction: Direction;
  pushed: boolean;
};

export type GameStats = {
  moves: number;
  pushes: number;
};

export type GameSliceState = {
  activeLevelRef: string;
  levelId: string;
  exactLevelKey?: string;
  history: GameMove[];
  stats: GameStats;
};

const builtinLevelsById = new Map(builtinLevels.map((level) => [level.id, level] as const));
const defaultLevelId = builtinLevels[0]?.id ?? 'level-unknown';
const defaultLevelRef = toBuiltinLevelRef(defaultLevelId);

function resolveExactLevelKey(levelId: string, exactLevelKey?: string): string | undefined {
  if (exactLevelKey) {
    return exactLevelKey;
  }

  const builtinLevel = builtinLevelsById.get(levelId);
  return builtinLevel ? createPlayableExactLevelKey(builtinLevel) : undefined;
}

const initialState: GameSliceState = {
  activeLevelRef: defaultLevelRef,
  levelId: defaultLevelId,
  exactLevelKey: resolveExactLevelKey(defaultLevelId),
  history: [],
  stats: {
    moves: 0,
    pushes: 0,
  },
};

export const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    move(
      state,
      action: {
        payload: {
          direction: Direction;
          pushed?: boolean;
          changed?: boolean;
        };
      },
    ) {
      const { direction, pushed = false, changed = true } = action.payload;

      if (!changed) {
        return;
      }

      state.history.push({ direction, pushed });
      state.stats.moves += 1;
      if (pushed) {
        state.stats.pushes += 1;
      }
    },
    applyMoveSequence(state, action: { payload: { moves: GameMove[] } }) {
      const { moves } = action.payload;
      if (moves.length === 0) {
        return;
      }

      for (const moveEntry of moves) {
        state.history.push(moveEntry);
        state.stats.moves += 1;
        if (moveEntry.pushed) {
          state.stats.pushes += 1;
        }
      }
    },
    undo(state) {
      if (state.history.length === 0) {
        return;
      }

      const last = state.history.pop();
      if (!last) {
        return;
      }

      state.stats.moves = Math.max(0, state.stats.moves - 1);
      if (last.pushed) {
        state.stats.pushes = Math.max(0, state.stats.pushes - 1);
      }
    },
    restart(state) {
      state.history = [];
      state.stats = { moves: 0, pushes: 0 };
    },
    nextLevel(
      state,
      action: { payload: { levelRef?: string; levelId: string; exactLevelKey?: string } },
    ) {
      state.activeLevelRef = action.payload.levelRef ?? toBuiltinLevelRef(action.payload.levelId);
      state.levelId = action.payload.levelId;
      state.exactLevelKey = resolveExactLevelKey(
        action.payload.levelId,
        action.payload.exactLevelKey,
      );
      state.history = [];
      state.stats = { moves: 0, pushes: 0 };
    },
  },
});

export const { move, applyMoveSequence, undo, restart, nextLevel } = gameSlice.actions;
