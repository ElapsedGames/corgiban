import type { Direction } from '@corgiban/shared';

import { SequenceInput, type SequenceApplyResult } from './SequenceInput';

export type BottomControlsProps = {
  onApplySequence: (directions: Direction[]) => SequenceApplyResult;
};

export function BottomControls({ onApplySequence }: BottomControlsProps) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-panel)] p-5 shadow-lg">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Sequence input</h2>
        <p className="text-sm text-[color:var(--color-muted)]">
          Paste a UDLR string to apply multiple moves in order.
        </p>
      </div>
      <SequenceInput onApplySequence={onApplySequence} />
    </section>
  );
}
