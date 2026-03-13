import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { GameState } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { GameCanvas } from '../canvas/GameCanvas';
import { useBoardPointerControls } from '../play/useBoardPointerControls';
import { Button } from '../ui/Button';

type LabPreviewPanelProps = {
  previewState: GameState;
  playHref?: string;
  benchHref?: string;
  onMove: (direction: Direction) => void;
  onReset: () => void;
  onOpenInPlay?: () => void;
  onSendToBench?: () => void;
};

export function LabPreviewPanel({
  previewState,
  playHref,
  benchHref,
  onMove,
  onReset,
  onOpenInPlay,
  onSendToBench,
}: LabPreviewPanelProps) {
  const headingId = useId();
  const previewStateRef = useRef(previewState);
  const [canvasNode, setCanvasNode] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    previewStateRef.current = previewState;
  }, [previewState]);

  const getPreviewState = useCallback(() => previewStateRef.current, []);
  useBoardPointerControls(canvasNode, {
    getGameState: getPreviewState,
    onMove,
  });

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <h2 id={headingId} className="text-lg font-semibold">
        Preview / Play
      </h2>
      <p className="text-sm text-muted">
        Verify the authored board locally before you spend worker time on it. Preview moves stay
        local here; solve and benchmark runs always restart from the parsed level state.
      </p>

      <div className="mt-4 flex justify-center overflow-auto rounded-app-md border border-border bg-bg p-3">
        <GameCanvas
          state={previewState}
          className="block max-w-full touch-none"
          canvasRef={setCanvasNode}
        />
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm text-muted">
          Moves: {previewState.stats.moves} | Pushes: {previewState.stats.pushes}
        </p>
        <p className="text-xs text-muted">
          Controls: tap/click adjacent tiles, swipe, Arrow keys / WASD move, R resets. Keyboard play
          pauses while you are typing in the editor.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset preview
        </Button>
        {onOpenInPlay ? (
          <button
            type="button"
            className="inline-flex min-h-[32px] items-center justify-center rounded-app-md border border-border px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent-border hover:bg-accent-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            onClick={onOpenInPlay}
          >
            Open in Play
          </button>
        ) : (
          <a
            className="inline-flex min-h-[32px] items-center justify-center rounded-app-md border border-border px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent-border hover:bg-accent-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            href={playHref}
          >
            Open in Play
          </a>
        )}
        {onSendToBench ? (
          <button
            type="button"
            className="inline-flex min-h-[32px] items-center justify-center rounded-app-md border border-border px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent-border hover:bg-accent-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            onClick={onSendToBench}
          >
            Send to Bench
          </button>
        ) : (
          <a
            className="inline-flex min-h-[32px] items-center justify-center rounded-app-md border border-border px-3 py-1.5 text-sm font-medium text-accent transition hover:border-accent-border hover:bg-accent-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            href={benchHref}
          >
            Send to Bench
          </a>
        )}
      </div>
    </section>
  );
}
