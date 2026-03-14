import { describe, expect, it } from 'vitest';

import {
  createLegacyPlayableExactLevelKey,
  createPlayableExactLevelKey,
  matchesPlayableExactLevelKey,
} from '../playableIdentity';

describe('playableIdentity', () => {
  const level = {
    id: 'identity-test-level',
    name: 'Identity Test Level',
    rows: ['WWWWW', 'WPBTW', 'WEEEW', 'WWWWW'],
    knownSolution: 'rR',
  };

  it('creates compact exact keys instead of embedding the raw level payload', () => {
    const exactLevelKey = createPlayableExactLevelKey(level);

    expect(exactLevelKey.startsWith('playable:v2:')).toBe(true);
    expect(exactLevelKey).not.toContain(level.rows[0]);
    expect(exactLevelKey).not.toContain(level.knownSolution ?? '');
    expect(exactLevelKey).not.toContain(level.name);
  });

  it('matches both compact keys and legacy serialized exact keys for backward compatibility', () => {
    expect(matchesPlayableExactLevelKey(level, createPlayableExactLevelKey(level))).toBe(true);
    expect(matchesPlayableExactLevelKey(level, createLegacyPlayableExactLevelKey(level))).toBe(
      true,
    );
  });

  it('changes the compact exact key when the committed payload changes', () => {
    const originalKey = createPlayableExactLevelKey(level);
    const renamedLevelKey = createPlayableExactLevelKey({
      ...level,
      name: 'Renamed Identity Test Level',
    });
    const changedRowsKey = createPlayableExactLevelKey({
      ...level,
      rows: ['WWWWW', 'WPBEW', 'WETEW', 'WWWWW'],
    });

    expect(renamedLevelKey).not.toBe(originalKey);
    expect(changedRowsKey).not.toBe(originalKey);
  });
});
