import { describe, expect, it } from 'vitest';

import { moveIndex } from '../position';

describe('moveIndex', () => {
  it('returns null when moving outside the grid', () => {
    expect(moveIndex(0, 2, 2, 'U')).toBeNull();
    expect(moveIndex(0, 2, 2, 'L')).toBeNull();
  });
});
