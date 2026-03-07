import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { analyzeAll, analyzeFile, classifySizeStatus, detectTimeUsage } from '../analyzeFiles';

// Use fileURLToPath for cross-Node compatibility (import.meta.dirname requires Node 21.2+).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const thisFile = path.resolve(__dirname, 'analyzeFiles.test.ts');
const srcRoot = path.resolve(__dirname, '..', '..');

describe('classifySizeStatus', () => {
  it('returns P for files under 300 lines', () => {
    expect(classifySizeStatus(0)).toBe('P');
    expect(classifySizeStatus(1)).toBe('P');
    expect(classifySizeStatus(299)).toBe('P');
  });

  it('returns W at exactly 300 lines', () => {
    expect(classifySizeStatus(300)).toBe('W');
  });

  it('returns W for files between 300 and 549 lines', () => {
    expect(classifySizeStatus(301)).toBe('W');
    expect(classifySizeStatus(549)).toBe('W');
  });

  it('returns F at exactly 550 lines', () => {
    expect(classifySizeStatus(550)).toBe('F');
  });

  it('returns F for files over 550 lines', () => {
    expect(classifySizeStatus(551)).toBe('F');
    expect(classifySizeStatus(10_000)).toBe('F');
  });
});

describe('detectTimeUsage', () => {
  it('returns false for source with no time access', () => {
    expect(detectTimeUsage('const x = 1;')).toBe(false);
    expect(detectTimeUsage('')).toBe(false);
  });

  it('detects Date.now() as hasTimeUsage: true', () => {
    expect(detectTimeUsage('const ts = Date.now();')).toBe(true);
  });

  it('detects new Date() as hasTimeUsage: true', () => {
    expect(detectTimeUsage('const d = new Date();')).toBe(true);
  });

  it('does not false-positive on string literals mentioning Date', () => {
    // 'Date' alone (e.g. a type annotation) should not trigger
    expect(detectTimeUsage('const d: Date = someDate;')).toBe(false);
  });
});

describe('analyzeFile', () => {
  it('returns a record with a relative path, positive line count, and valid sizeStatus', () => {
    const record = analyzeFile(thisFile, srcRoot);
    expect(record.path).not.toContain(srcRoot); // relative, not absolute
    expect(record.lines).toBeGreaterThan(0);
    expect(['P', 'W', 'F']).toContain(record.sizeStatus);
  });

  it('uses classifySizeStatus consistently - a small file gets P status', () => {
    const record = analyzeFile(thisFile, srcRoot);
    // This test file is well under 300 lines
    expect(record.sizeStatus).toBe('P');
  });
});

describe('analyzeAll', () => {
  it('sorts records by relative path', () => {
    // analyzeAll requires real files; use this test file and its neighbour
    const reportFormatterTest = path.resolve(__dirname, 'reportFormatter.test.ts');
    const records = analyzeAll([reportFormatterTest, thisFile], srcRoot);
    const paths = records.map((r) => r.path);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
  });
});
