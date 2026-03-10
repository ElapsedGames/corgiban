import { describe, expect, it } from 'vitest';

import { getMaxWidthMediaQuery, getMinWidthMediaQuery } from '../responsive';

describe('responsive helpers', () => {
  it('builds a max-width query that stays below the named breakpoint', () => {
    expect(getMaxWidthMediaQuery('lg')).toBe('(max-width: 1023px)');
  });

  it('builds a min-width query at the named breakpoint', () => {
    expect(getMinWidthMediaQuery('lg')).toBe('(min-width: 1024px)');
  });
});
