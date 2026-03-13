import { describe, expect, it } from 'vitest';

import { getAlgorithm, listAlgorithms } from '../registry';

const REGISTERED_ALGORITHMS = [
  'bfsPush',
  'astarPush',
  'idaStarPush',
  'greedyPush',
  'tunnelMacroPush',
  'piCorralPush',
] as const;

describe('registry', () => {
  it('lists exactly the registered algorithm ids', () => {
    expect(listAlgorithms()).toEqual(REGISTERED_ALGORITHMS);
  });

  it.each(REGISTERED_ALGORITHMS)(
    'returns the registered %s algorithm with a solve function',
    (algorithmId: (typeof REGISTERED_ALGORITHMS)[number]) => {
      const algorithm = getAlgorithm(algorithmId);

      expect(algorithm?.id).toBe(algorithmId);
      expect(typeof algorithm?.solve).toBe('function');
    },
  );

  it('returns undefined for an unregistered id', () => {
    expect(getAlgorithm('nonexistent' as any)).toBeUndefined();
  });
});
