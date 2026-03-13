import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseOutDir, REPORT_FILENAME, run } from '../bestPracticesReport';

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
  let tempRoot = '';

  beforeEach(() => {
    tempRoot = mkdtempSync(path.join(os.tmpdir(), 'corgiban-best-practices-'));
    mkdirSync(path.join(tempRoot, 'packages/shared/src'), { recursive: true });
    writeFileSync(
      path.join(tempRoot, 'packages/shared/src/example.ts'),
      'export const example = 1;\n',
      'utf8',
    );
  });

  afterEach(() => {
    logSpy.mockClear();
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true });
      tempRoot = '';
    }
  });

  it('writes the report to the default analysis directory', async () => {
    await run([], { root: tempRoot, generatedAt: new Date('2026-03-11T00:00:00.000Z') });
    const outputPath = path.join(tempRoot, 'docs/_generated/analysis', REPORT_FILENAME);
    const output = readFileSync(outputPath, 'utf8');

    expect(output).toContain('# Best Practices Report');
    expect(output).toContain('Scanned files: 1');
    expect(logSpy).toHaveBeenCalledWith('Wrote docs/_generated/analysis/best_practices_report.md');
  });

  it('writes the report to the requested out dir when provided', async () => {
    await run(['--out-dir', 'dist/reports'], {
      root: tempRoot,
      generatedAt: new Date('2026-03-11T00:00:00.000Z'),
    });
    const outputPath = path.join(tempRoot, 'dist/reports', REPORT_FILENAME);

    expect(readFileSync(outputPath, 'utf8')).toContain('Scanned files: 1');
    expect(logSpy).toHaveBeenCalledWith('Wrote dist/reports/best_practices_report.md');
  });

  it('uses the current date when generatedAt is omitted', async () => {
    await run([], { root: tempRoot });
    const outputPath = path.join(tempRoot, 'docs/_generated/analysis', REPORT_FILENAME);

    expect(readFileSync(outputPath, 'utf8')).toContain('# Best Practices Report');
    expect(logSpy).toHaveBeenCalledWith('Wrote docs/_generated/analysis/best_practices_report.md');
  });

  it('logs CLI entry failures and sets a non-zero exit code', async () => {
    const modulePath = fileURLToPath(new URL('../bestPracticesReport.ts', import.meta.url));
    const previousArgv = [...process.argv];
    const previousExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.resetModules();
    vi.doMock('../scanFiles', () => ({
      DEFAULT_SCAN_EXCLUDE: [],
      DEFAULT_SCAN_INCLUDE: [],
      scanFiles: vi.fn(async () => {
        throw new Error('scan failed');
      }),
    }));
    vi.doMock('../analyzeFiles', () => ({
      analyzeAll: vi.fn(() => []),
    }));
    vi.doMock('../reportFormatter', () => ({
      formatReport: vi.fn(() => ''),
    }));

    process.argv = [previousArgv[0] ?? 'node', modulePath];
    process.exitCode = 0;

    try {
      await import('../bestPracticesReport');
      await Promise.resolve();

      expect(errorSpy).toHaveBeenCalledWith(
        'best-practices report command failed:',
        expect.any(Error),
      );
      expect(process.exitCode).toBe(1);
    } finally {
      process.argv = previousArgv;
      process.exitCode = previousExitCode;
      errorSpy.mockRestore();
      vi.resetModules();
    }
  });
});
