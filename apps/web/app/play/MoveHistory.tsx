import type { GameMove } from '../state/gameSlice';

export type MoveHistoryProps = {
  moves: GameMove[];
};

const MAX_VISIBLE = 12;

export function MoveHistory({ moves }: MoveHistoryProps) {
  if (moves.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-border)] p-3 text-xs text-[color:var(--color-muted)]">
        No moves yet. Use the keyboard or sequence input to start.
      </div>
    );
  }

  const recentMoves = moves.slice(-MAX_VISIBLE);
  const offset = moves.length - recentMoves.length;

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {moves.length} move{moves.length === 1 ? '' : 's'} made
      </div>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
        <span>Move history</span>
        <span>{moves.length} total</span>
      </div>
      <ol aria-label="Move history" className="grid grid-cols-3 gap-2 text-sm">
        {recentMoves.map((move, index) => {
          const absoluteIndex = offset + index + 1;
          const badgeClasses = move.pushed
            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-200'
            : 'bg-slate-500/20 text-slate-600 dark:text-slate-200';

          return (
            <li
              key={`${absoluteIndex}-${move.direction}`}
              className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-2 py-1 text-center"
            >
              <div className="text-xs text-[color:var(--color-muted)]">#{absoluteIndex}</div>
              <div className="text-base font-semibold">{move.direction}</div>
              <div className={`mt-1 rounded px-1 text-[10px] uppercase ${badgeClasses}`}>
                {move.pushed ? 'push' : 'walk'}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
