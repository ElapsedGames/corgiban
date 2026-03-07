import { describe, expect, it } from 'vitest';

import { parseOutDir } from '../bestPracticesReport';

describe('parseOutDir', () => {
  it('returns null when --out-dir flag is absent', () => {
    expect(parseOutDir([])).toBeNull();
    expect(parseOutDir(['--other', 'value'])).toBeNull();
  });

  it('returns the value immediately following --out-dir', () => {
    expect(parseOutDir(['--out-dir', 'dist/reports'])).toBe('dist/reports');
  });

  it('returns null when --out-dir is the last argument (no value follows)', () => {
    expect(parseOutDir(['--out-dir'])).toBeNull();
  });

  it('returns null when the value following --out-dir starts with a dash (another flag)', () => {
    expect(parseOutDir(['--out-dir', '--other'])).toBeNull();
  });

  it('returns the correct value when other flags precede --out-dir', () => {
    expect(parseOutDir(['--verbose', '--out-dir', 'output/dir', '--format', 'json'])).toBe(
      'output/dir',
    );
  });
});
