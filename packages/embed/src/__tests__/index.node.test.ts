// @vitest-environment node

import { describe, expect, it } from 'vitest';

describe('@corgiban/embed entrypoint', () => {
  it('can be imported and defined in a non-browser environment without throwing', async () => {
    const module = await import('../index');

    expect(typeof module.defineCorgibanEmbed).toBe('function');
    expect(() => module.defineCorgibanEmbed()).not.toThrow();
  });
});
