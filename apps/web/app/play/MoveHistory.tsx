import { useEffect, useMemo, useState } from 'react';

import type { GameMove } from '../state/gameSlice';
import { Button } from '../ui/Button';

export type MoveHistoryProps = {
  moves: GameMove[];
  mode?: 'full' | 'copyOnly';
};

function formatMoveList(moves: GameMove[]): string {
  return moves.map((move) => move.direction).join('');
}

export function MoveHistory({ moves, mode = 'full' }: MoveHistoryProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const moveList = useMemo(() => formatMoveList(moves), [moves]);

  useEffect(() => {
    setCopyStatus('idle');
  }, [moveList]);

  const handleCopyMoveList = async () => {
    if (moveList.length === 0 || !navigator.clipboard?.writeText) {
      setCopyStatus('failed');
      return;
    }

    try {
      await navigator.clipboard.writeText(moveList);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {copyStatus === 'copied'
          ? 'Move list copied.'
          : copyStatus === 'failed'
            ? 'Move list could not be copied.'
            : `${moves.length} move${moves.length === 1 ? '' : 's'} made`}
      </div>
      {mode === 'full' ? (
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
          <span>Move History</span>
          <span>{moves.length} total</span>
        </div>
      ) : null}
      <div className={mode === 'copyOnly' ? undefined : 'rounded-app-md border border-border p-3'}>
        <Button
          className="w-full"
          variant="secondary"
          onClick={() => {
            void handleCopyMoveList();
          }}
          disabled={moveList.length === 0}
        >
          Copy Move List
        </Button>
      </div>
      {/* Keep the old detailed move-card layout parked here until we decide whether it should return. */}
    </div>
  );
}
