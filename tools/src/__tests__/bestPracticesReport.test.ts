import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseOutDir, run } from '../bestPracticesReport';

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

describe('run', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
  });

  it('logs unavailable message without suffix when no --out-dir', async () => {
    await run([]);
    expect(logSpy).toHaveBeenCalledWith('best-practices report generation is unavailable.');
  });

  it('logs unavailable message with suffix when --out-dir is provided', async () => {
    await run(['--out-dir', 'dist/reports']);
    expect(logSpy).toHaveBeenCalledWith(
      'best-practices report generation is unavailable. (requested out dir: dist/reports)',
    );
  });
});
