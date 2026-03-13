import { describe, expect, it } from 'vitest';

import { links, meta } from '../root';

describe('root metadata', () => {
  it('publishes branded preview metadata for link unfurls', () => {
    const metadata = meta({} as Parameters<typeof meta>[0]);

    expect(metadata).toEqual(
      expect.arrayContaining([
        { title: 'Corgiban' },
        {
          name: 'description',
          content: 'Deterministic Sokoban game, solver, and benchmark suite.',
        },
        { property: 'og:image', content: 'https://corgiban.elapsedgames.com/social-card.png' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ]),
    );
  });

  it('links the non-svg brand assets for preview and install surfaces', () => {
    expect(links()).toEqual(
      expect.arrayContaining([
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'shortcut icon', href: '/favicon.ico' },
      ]),
    );
  });
});
