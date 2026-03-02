import type { GameMove, GameStats } from '../state/gameSlice';
import { Button } from '../ui/Button';
import { MoveHistory } from './MoveHistory';

export type SidePanelProps = {
  levelName: string;
  levelId: string;
  stats: GameStats;
  moves: GameMove[];
  isSolved: boolean;
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
        <h2 className="text-xl font-semibold text-[color:var(--color-fg)]">{levelName}</h2>
        <p className="text-xs text-[color:var(--color-muted)]">{levelId}</p>
        {isSolved ? (
          <span className="mt-2 inline-flex rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-200">
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

      <div className="flex flex-wrap gap-2">
        <Button onClick={onRestart}>Restart</Button>
        <Button variant="secondary" onClick={onUndo} disabled={moves.length === 0}>
          Undo
        </Button>
        <Button variant="ghost" onClick={onNextLevel}>
          Next level
        </Button>
      </div>

      <MoveHistory moves={moves} />
    </aside>
  );
}
