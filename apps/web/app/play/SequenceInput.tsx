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

export function SequenceInput({ onApplySequence }: SequenceInputProps) {
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseSequence(value);
    if (parsed.error) {
      setMessage(parsed.error);
      return;
    }

    const result = onApplySequence(parsed.directions);
    if (result.applied === 0) {
      setMessage('No moves applied.');
      return;
    }

    if (result.stoppedAt !== null) {
      setMessage(`Stopped at step ${result.stoppedAt + 1} of ${parsed.directions.length}.`);
    } else {
      setMessage(`Applied ${result.applied} moves.`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Input
          label="Sequence input"
          placeholder="UDLR sequence"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          hint="Whitespace is ignored. Invalid characters are rejected."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Button type="submit">Apply moves</Button>
        {message ? <p className="text-xs text-[color:var(--color-muted)]">{message}</p> : null}
      </div>
    </form>
  );
}
