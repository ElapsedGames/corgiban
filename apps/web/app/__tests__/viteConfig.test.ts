import { describe, expect, it } from 'vitest';

import viteConfig from '../../vite.config';

describe('vite config', () => {
  it('dedupes the React runtime entrypoints', () => {
    const dedupe = viteConfig.resolve?.dedupe;

    expect(dedupe).toEqual(
      expect.arrayContaining(['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']),
    );
  });
});
