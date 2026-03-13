import { describe, expect, it } from 'vitest';

import IndexRoute, { loader, meta } from '../_index';

describe('IndexRoute', () => {
  it('redirects the root route to /play', async () => {
    const response = await loader({
      request: new Request('http://localhost/'),
      params: {},
      context: {},
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/play');
  });

  it('renders no landing-page content because the loader redirects first', () => {
    expect(IndexRoute()).toBeNull();
  });

  it('publishes the root title metadata', () => {
    expect(meta({} as never)).toEqual([{ title: 'Corgiban' }]);
  });
});
