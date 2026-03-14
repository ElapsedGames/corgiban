import { useId } from 'react';

import type { Direction } from '@corgiban/shared';

import { SequenceInput, type SequenceAnimationResult } from './SequenceInput';

export type BottomControlsProps = {
  replaySpeed: number;
  onAnimateSequence: (directions: Direction[]) => SequenceAnimationResult;
  onReplaySpeedChange: (speed: number) => void;
};

export function BottomControls({
  replaySpeed,
  onAnimateSequence,
  onReplaySpeedChange,
}: BottomControlsProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-app-lg border border-border bg-panel p-5 shadow-lg"
    >
      <div className="mb-4">
        <h2 id={headingId} className="text-lg font-semibold">
          Move Sequence
        </h2>
      </div>
      <SequenceInput
        replaySpeed={replaySpeed}
        onAnimateSequence={onAnimateSequence}
        onReplaySpeedChange={onReplaySpeedChange}
      />
    </section>
  );
}
