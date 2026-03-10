import { useCallback, useEffect, useId, useRef, useState } from 'react';

import type { GameState } from '@corgiban/core';
import type { Direction } from '@corgiban/shared';

import { GameCanvas } from '../canvas/GameCanvas';
import { useBoardPointerControls } from '../play/useBoardPointerControls';
import { Button } from '../ui/Button';

type LabPreviewPanelProps = {
  previewState: GameState;
  onMove: (direction: Direction) => void;
  onReset: () => void;
};

export function LabPreviewPanel({ previewState, onMove, onReset }: LabPreviewPanelProps) {
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
        Use tap/click adjacent tiles, swipe, or arrow keys / WASD to verify gameplay before running
        solver or benchmark checks. Preview moves stay local here; worker runs always reset from the
        authored level state.
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
          Controls: tap/click adjacent tiles, swipe, Arrow keys / WASD move, R resets. Keyboard
          input pauses while typing in the editor.
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
