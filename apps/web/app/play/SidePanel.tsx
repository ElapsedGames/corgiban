import type { GameMove, GameStats } from '../state/gameSlice';
import { Button } from '../ui/Button';
import { MoveHistory } from './MoveHistory';

export type SidePanelProps = {
  levelName: string;
  levelId: string;
  stats: GameStats;
  moves: GameMove[];
  isSolved: boolean;
  canGoToPreviousLevel: boolean;
  onPreviousLevel: () => void;
  onRestart: () => void;
  onUndo: () => void;
  onNextLevel: () => void;
};

export function SidePanel({
  levelName,
  levelId,
  stats,
  moves,
  isSolved,
  canGoToPreviousLevel,
  onPreviousLevel,
  onRestart,
  onUndo,
  onNextLevel,
}: SidePanelProps) {
  return (
    <aside className="flex h-fit flex-col gap-6 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-wide text-[color:var(--color-muted)]">
          Current level
        </p>
        <h2
          className="truncate text-xl font-semibold text-[color:var(--color-fg)]"
          title={levelName}
        >
          {levelName}
        </h2>
        <p className="truncate text-xs text-[color:var(--color-muted)]" title={levelId}>
          {levelId}
        </p>
        {isSolved ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm dark:bg-emerald-600">
            <span aria-hidden="true">&#10003;</span>
            Solved
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-3 py-2">
          <div className="text-xs text-[color:var(--color-muted)]">Moves</div>
          <div className="text-lg font-semibold">{stats.moves}</div>
        </div>
        <div className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-3 py-2">
          <div className="text-xs text-[color:var(--color-muted)]">Pushes</div>
          <div className="text-lg font-semibold">{stats.pushes}</div>
        </div>
      </div>

      <div role="group" aria-label="Game controls" className="grid grid-cols-2 gap-2">
        <Button className="w-full" onClick={onRestart}>
          Restart
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          onClick={onUndo}
          disabled={moves.length === 0}
        >
          Undo
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          onClick={onPreviousLevel}
          disabled={!canGoToPreviousLevel}
        >
          Previous
        </Button>
        <Button className="w-full" variant="secondary" onClick={onNextLevel}>
          Next Level
        </Button>
      </div>

      <MoveHistory moves={moves} />
    </aside>
  );
}
