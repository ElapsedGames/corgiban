import { useId } from 'react';

import type { GameState } from '@corgiban/core';

import { GameCanvas } from '../canvas/GameCanvas';
import { Button } from '../ui/Button';

type LabPreviewPanelProps = {
  previewState: GameState;
  onReset: () => void;
};

export function LabPreviewPanel({ previewState, onReset }: LabPreviewPanelProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        Preview / Play
      </h2>
      <p className="text-sm text-[color:var(--color-muted)]">
        Use arrow keys or WASD to verify gameplay before running solver or benchmark checks. Preview
        moves stay local here; worker runs always reset from the authored level state.
      </p>

      <div className="mt-4 overflow-auto rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-3">
        <GameCanvas state={previewState} />
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm text-[color:var(--color-muted)]">
          Moves: {previewState.stats.moves} | Pushes: {previewState.stats.pushes}
        </p>
        <p className="text-xs text-[color:var(--color-muted)]">
          Shortcuts: Arrow keys / WASD move, R resets. Keyboard input pauses while typing in the
          editor.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset preview
        </Button>
      </div>
    </section>
  );
}
