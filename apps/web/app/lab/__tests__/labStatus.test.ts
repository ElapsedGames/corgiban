import { describe, expect, it } from 'vitest';

import type { SolveState } from '../labTypes';
import { statusText, toDirectionArray } from '../labStatus';

describe('labStatus', () => {
  it('keeps only uppercase cardinal directions when converting solution text', () => {
    expect(toDirectionArray('UDLRudlr?X')).toEqual(['U', 'D', 'L', 'R']);
  });

  it('formats solve and bench statuses consistently', () => {
    expect(statusText({ status: 'idle' })).toBe('idle');
    expect(statusText({ status: 'running' })).toBe('running');
    expect(statusText({ status: 'cancelled', message: 'stop requested' })).toBe(
      'cancelled: stop requested',
    );
    expect(statusText({ status: 'failed', message: 'bad level' })).toBe('failed: bad level');
    expect(
      statusText({
        status: 'completed',
        algorithmId: 'bfsPush',
        resultStatus: 'solved',
        elapsedMs: 12.34,
      }),
    ).toBe('solved (12.3 ms)');
    expect(statusText({ status: 'mystery' } as unknown as SolveState)).toBe('running');
  });
});
