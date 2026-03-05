import { describe, expect, it } from 'vitest';

import { directionOrder, directionVectors } from '../direction';

describe('directionVectors', () => {
  it('maps every direction to the expected delta vector', () => {
    expect(directionVectors).toEqual({
      U: { dx: 0, dy: -1 },
      D: { dx: 0, dy: 1 },
      L: { dx: -1, dy: 0 },
      R: { dx: 1, dy: 0 },
    });
  });
});

describe('directionOrder', () => {
  it('keeps canonical UDLR ordering', () => {
    expect(directionOrder).toEqual(['U', 'D', 'L', 'R']);
  });
});
