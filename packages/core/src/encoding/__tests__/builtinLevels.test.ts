import { describe, expect, it } from 'vitest';

import { builtinLevels } from '@corgiban/levels';

import { parseLevel } from '../parseLevel';

describe('builtinLevels', () => {
  it('parses all builtin levels into valid runtime structures', () => {
    expect(builtinLevels.length).toBeGreaterThan(0);

    for (const level of builtinLevels) {
      let result;
      try {
        result = parseLevel(level);
      } catch (error) {
        throw new Error(`Failed to parse level ${level.id}: ${String(error)}`);
      }

      expect(result.levelId).toBe(level.id);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.staticGrid.length).toBe(result.width * result.height);
      expect(result.initialPlayerIndex).toBeGreaterThanOrEqual(0);
      expect(result.initialPlayerIndex).toBeLessThan(result.staticGrid.length);

      const boxes = Array.from(result.initialBoxes);
      for (let index = 1; index < boxes.length; index += 1) {
        expect(boxes[index]).toBeGreaterThan(boxes[index - 1]);
      }
    }
  });
});
