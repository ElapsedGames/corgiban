import { describe, expect, it } from 'vitest';

import { getAlgorithm, listAlgorithms } from '../registry';

describe('registry', () => {
  it('lists exactly the registered algorithm ids', () => {
    expect(listAlgorithms()).toEqual(['bfsPush']);
  });

  it('returns a registered algorithm with id and solve function', () => {
    const algorithm = getAlgorithm('bfsPush');

    expect(algorithm?.id).toBe('bfsPush');
    expect(typeof algorithm?.solve).toBe('function');
  });

  it('returns undefined for an unregistered id', () => {
    expect(getAlgorithm('nonexistent' as any)).toBeUndefined();
  });
});
