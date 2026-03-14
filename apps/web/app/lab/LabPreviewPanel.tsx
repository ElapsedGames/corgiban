import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { GameState } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { GameCanvas } from '../canvas/GameCanvas';
import { useBoardSkinPreference } from '../canvas/useAppBoardSkin';
import { useBoardPointerControls } from '../play/useBoardPointerControls';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';

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
  const { boardSkinId } = useBoardSkinPreference();
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
        Check the parsed board here before spending worker time on it. Moves in this preview stay
        local.
      </p>

      <div className="mt-4 flex justify-center overflow-auto rounded-app-md border border-border bg-bg p-3">
        <GameCanvas
          state={previewState}
          skinId={boardSkinId}
          className="block max-w-full touch-none"
          canvasRef={setCanvasNode}
        />
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-sm text-muted">
          Moves: {previewState.stats.moves} | Pushes: {previewState.stats.pushes}
        </p>
        <div className="inline-flex items-center gap-2 text-xs text-muted">
          <span>Controls</span>
          <Tooltip
            content="Tap or click an adjacent tile, swipe, or use Arrow keys or WASD to move. Press R to reset. Keyboard play pauses while you are typing in the editor."
            align="start"
          >
            <span
              role="button"
              tabIndex={0}
              aria-label="Preview controls help"
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[10px] font-bold leading-none text-muted"
            >
              i
            </span>
          </Tooltip>
        </div>
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
