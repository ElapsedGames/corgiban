import { useState } from 'react';
import type { FormEvent } from 'react';

import type { Direction } from '@corgiban/shared';

import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export type SequenceApplyResult = {
  applied: number;
  stoppedAt: number | null;
};

export type SequenceInputProps = {
  onApplySequence: (directions: Direction[]) => SequenceApplyResult;
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
    return { directions: [], error: 'Enter a UDLR sequence to apply.' };
  }

  return { directions };
}

type MessageState = {
  text: string;
  isError: boolean;
};

export function SequenceInput({ onApplySequence }: SequenceInputProps) {
  const [value, setValue] = useState('');
  const [messageState, setMessageState] = useState<MessageState | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseSequence(value);
    if (parsed.error) {
      setMessageState({ text: parsed.error, isError: true });
      return;
    }

    const result = onApplySequence(parsed.directions);
    if (result.applied === 0) {
      setMessageState({ text: 'No moves applied.', isError: true });
      return;
    }

    if (result.stoppedAt !== null) {
      setMessageState({
        text: `Stopped at step ${result.stoppedAt + 1} of ${parsed.directions.length}.`,
        isError: false,
      });
    } else {
      setMessageState({ text: `Applied ${result.applied} moves.`, isError: false });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
      <div className="w-full">
        <Input
          label="Sequence input"
          placeholder="UDLR sequence"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          hint="Whitespace is ignored. Invalid characters are rejected."
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <Button type="submit">Apply Moves</Button>
        {messageState ? (
          <p
            className="text-xs text-muted sm:max-w-[24rem]"
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
