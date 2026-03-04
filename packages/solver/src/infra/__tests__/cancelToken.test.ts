import { describe, expect, it } from 'vitest';

import { CancelToken } from '../cancelToken';

describe('CancelToken', () => {
  it('tracks cancellation state and reason', () => {
    const token = new CancelToken();

    expect(token.isCancelled()).toBe(false);
    expect(token.getReason()).toBeUndefined();

    token.cancel('stop');

    expect(token.isCancelled()).toBe(true);
    expect(token.getReason()).toBe('stop');
  });

  it('overwrites the reason on a subsequent cancel', () => {
    const token = new CancelToken();

    token.cancel('first');
    token.cancel('second');

    expect(token.isCancelled()).toBe(true);
    expect(token.getReason()).toBe('second');
  });
});
