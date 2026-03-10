import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { scanFiles } from '../scanFiles';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.resolve(__dirname, '..');

describe('scanFiles', () => {
  it('returns empty array when include is empty', async () => {
    const result = await scanFiles({ root: srcDir, include: [], exclude: [] });
    expect(result).toEqual([]);
  });

  it('finds files matching a glob pattern', async () => {
    const result = await scanFiles({ root: srcDir, include: ['*.ts'], exclude: [] });
    expect(result.length).toBeGreaterThan(0);
    // fast-glob returns forward-slash paths even on Windows
    const expected = path.resolve(srcDir, 'scanFiles.ts').replace(/\\/g, '/');
    expect(result).toContain(expected);
  });

  it('excludes files matching exclude patterns', async () => {
    const all = await scanFiles({ root: srcDir, include: ['*.ts'], exclude: [] });
    const filtered = await scanFiles({
      root: srcDir,
      include: ['*.ts'],
      exclude: ['scanFiles.ts'],
    });
    expect(filtered.length).toBeLessThan(all.length);
    const excluded = path.resolve(srcDir, 'scanFiles.ts').replace(/\\/g, '/');
    expect(filtered).not.toContain(excluded);
  });

  it('returns absolute paths', async () => {
    const result = await scanFiles({ root: srcDir, include: ['*.ts'], exclude: [] });
    for (const filePath of result) {
      expect(path.isAbsolute(filePath)).toBe(true);
    }
  });

  it('returns results sorted lexicographically', async () => {
    const result = await scanFiles({ root: srcDir, include: ['*.ts'], exclude: [] });
    const sorted = [...result].sort((a, b) => a.localeCompare(b));
    expect(result).toEqual(sorted);
  });
});
