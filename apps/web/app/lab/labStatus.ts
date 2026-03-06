import type { Direction } from '@corgiban/core';

import type { BenchState, SolveState } from './labTypes';

export function toDirectionArray(solutionMoves: string): Direction[] {
  return [...solutionMoves].filter((token): token is Direction => {
    return token === 'U' || token === 'D' || token === 'L' || token === 'R';
  });
}

export function statusText(value: SolveState | BenchState): string {
  if (value.status === 'idle') {
    return 'idle';
  }
  if (value.status === 'running') {
    return 'running';
  }
  if (value.status === 'cancelled') {
    return `cancelled: ${value.message}`;
  }
  if (value.status === 'failed') {
    return `failed: ${value.message}`;
  }
  if (value.status === 'completed') {
    return `${value.resultStatus} (${value.elapsedMs.toFixed(1)} ms)`;
  }

  return 'running';
}
