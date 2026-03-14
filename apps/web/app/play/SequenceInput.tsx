import { useState } from 'react';
import type { FormEvent } from 'react';

import type { Direction } from '@corgiban/shared';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { REPLAY_SPEED_OPTIONS, inlineSelectClass } from './SolverControls';

export type SequenceAnimationResult = {
  applied: number;
  stoppedAt: number | null;
};

export type SequenceInputProps = {
  replaySpeed: number;
  onAnimateSequence: (directions: Direction[]) => SequenceAnimationResult;
  onReplaySpeedChange: (speed: number) => void;
};

type ParsedSequence = {
  directions: Direction[];
  error?: string;
};

function parseSequence(input: string): ParsedSequence {
  const directions: Direction[] = [];

  for (const char of input) {
    if (/\s/.test(char)) {
      continue;
    }

    const upper = char.toUpperCase();
    if (upper === 'U' || upper === 'D' || upper === 'L' || upper === 'R') {
      directions.push(upper as Direction);
      continue;
    }

    return { directions: [], error: `Invalid character "${char}".` };
  }

  if (directions.length === 0) {
    return { directions: [], error: 'Enter a UDLR sequence to animate.' };
  }

  return { directions };
}

type MessageState = {
  text: string;
  isError: boolean;
};

export function SequenceInput({
  replaySpeed,
  onAnimateSequence,
  onReplaySpeedChange,
}: SequenceInputProps) {
  const [value, setValue] = useState('');
  const [messageState, setMessageState] = useState<MessageState | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseSequence(value);
    if (parsed.error) {
      setMessageState({ text: parsed.error, isError: true });
      return;
    }

    const result = onAnimateSequence(parsed.directions);
    if (result.applied === 0) {
      setMessageState({ text: 'No moves animated.', isError: true });
      return;
    }

    if (result.stoppedAt !== null) {
      setMessageState({
        text: `Animating ${result.applied} moves. Stopped at step ${result.stoppedAt + 1} of ${parsed.directions.length}.`,
        isError: false,
      });
    } else {
      setMessageState({ text: `Animating ${result.applied} moves.`, isError: false });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="w-full">
        <Input
          label="Move Sequence"
          annotation="Use U, D, L, and R. Spaces are ignored, and any other character is rejected."
          annotationAlign="start"
          placeholder="UDLR sequence"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-3">
          <Button
            type="submit"
            variant="tonal"
            className="min-h-[42px] min-w-[8.75rem] px-5 py-2 text-sm"
          >
            Animate
          </Button>
          <div className="inline-flex items-center gap-2">
            <label className="sr-only" htmlFor="sequence-replay-speed-select">
              Move sequence speed
            </label>
            <select
              id="sequence-replay-speed-select"
              aria-label="Move sequence speed"
              className={`${inlineSelectClass} min-h-[42px] min-w-[5.5rem] px-3 py-2 text-sm`}
              value={String(replaySpeed)}
              onChange={(event) => {
                const nextSpeed = Number(event.target.value);
                if (!Number.isFinite(nextSpeed) || nextSpeed <= 0) {
                  return;
                }
                onReplaySpeedChange(nextSpeed);
              }}
            >
              {REPLAY_SPEED_OPTIONS.map((option) => (
                <option key={option.value} value={String(option.value)}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {messageState ? (
          <p
            className="min-h-[42px] text-sm text-muted inline-flex items-center"
            aria-live={messageState.isError ? 'assertive' : 'polite'}
            role={messageState.isError ? 'alert' : undefined}
          >
            {messageState.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}
