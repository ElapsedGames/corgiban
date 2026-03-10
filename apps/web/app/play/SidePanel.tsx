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
    <aside className="flex h-fit flex-col gap-4 rounded-app-lg border border-border bg-panel p-4 shadow-lg lg:gap-6 lg:p-5">
      <div className="hidden items-start justify-between gap-3 lg:flex">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">Current level</p>
          <h2 className="truncate text-xl font-semibold text-fg" title={levelName}>
            {levelName}
          </h2>
          <p className="truncate text-xs text-muted" title={levelId}>
            {levelId}
          </p>
        </div>
        <span
          className={`mt-5 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success px-3 py-1 text-xs font-bold text-white shadow-sm ${
            isSolved ? '' : 'invisible'
          }`}
        >
          <span aria-hidden="true">&#10003;</span>
          Solved
        </span>
      </div>

      <div className="hidden grid-cols-2 gap-3 text-sm lg:grid">
        <div className="rounded-app-md border border-border px-3 py-2">
          <div className="text-xs text-muted">Moves</div>
          <div className="text-lg font-semibold">{stats.moves}</div>
        </div>
        <div className="rounded-app-md border border-border px-3 py-2">
          <div className="text-xs text-muted">Pushes</div>
          <div className="text-lg font-semibold">{stats.pushes}</div>
        </div>
      </div>

      <div role="group" aria-label="Game controls" className="grid grid-cols-2 gap-2">
        <Button className="w-full" variant="tonal" onClick={onRestart}>
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
        <Button
          className="w-full"
          variant={isSolved ? 'primary' : 'secondary'}
          onClick={onNextLevel}
        >
          Next Level
        </Button>
      </div>

      <div className="hidden lg:block">
        <MoveHistory moves={moves} />
      </div>
    </aside>
  );
}
