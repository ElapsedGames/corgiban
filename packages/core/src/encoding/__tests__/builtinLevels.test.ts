import { describe, it } from 'vitest';

import { builtinLevels } from '@corgiban/levels';

import { parseLevel } from '../parseLevel';

describe('builtinLevels', () => {
  it('parses all builtin levels', () => {
    for (const level of builtinLevels) {
      try {
        parseLevel(level);
      } catch (error) {
        throw new Error(`Failed to parse level ${level.id}: ${String(error)}`);
      }
    }
  });
});
