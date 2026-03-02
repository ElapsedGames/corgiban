import type { Direction } from '@corgiban/shared';

import type { GameState } from '../model/gameState';
import { applyMove } from './applyMove';

export type ApplyMovesOptions = {
  stopOnNoChange?: boolean;
};

export type ApplyMovesResult = {
  state: GameState;
  changed: boolean;
  stoppedAt?: number;
};

export function applyMoves(
  state: GameState,
  directions: Direction[],
  options: ApplyMovesOptions = {},
): ApplyMovesResult {
  let current = state;
  let changed = false;
  const { stopOnNoChange = false } = options;

  for (let index = 0; index < directions.length; index += 1) {
    const result = applyMove(current, directions[index]);

    if (!result.changed) {
      if (stopOnNoChange) {
        return { state: current, changed, stoppedAt: index };
      }
      continue;
    }

    changed = true;
    current = result.state;
  }

  return { state: current, changed };
}
