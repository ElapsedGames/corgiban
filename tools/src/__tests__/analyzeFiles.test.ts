import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { analyzeAll, analyzeFile } from '../analyzeFiles';

function createTempRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'corgiban-analyze-files-'));
}

function writeLines(root: string, relativePath: string, lineCount: number, line = 'const x = 1;') {
  const absolutePath = path.join(root, relativePath);
  const directory = path.dirname(absolutePath);
  mkdirSync(directory, { recursive: true });
  writeFileSync(absolutePath, Array.from({ length: lineCount }, () => line).join('\n'), 'utf8');
  return absolutePath;
}

describe('analyzeFiles', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    tempRoots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
  });

  it('marks files up to 500 lines as pass-sized', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(root, 'packages/shared/src/pass.ts', 500);

    expect(analyzeFile(absolutePath, root).sizeStatus).toBe('P');
  });

  it('marks files from 501 to 800 lines as warn-sized', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(root, 'packages/shared/src/warn.ts', 501);

    expect(analyzeFile(absolutePath, root).sizeStatus).toBe('W');
  });

  it('marks files over 800 lines as fail-sized', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(root, 'packages/shared/src/fail.ts', 801);

    expect(analyzeFile(absolutePath, root).sizeStatus).toBe('F');
  });

  it('detects Date.now usage inside packages/core/src files', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(
      root,
      'packages/core/src/clock.ts',
      1,
      'const now = Date.now();',
    );

    expect(analyzeFile(absolutePath, root).hasTimeUsage).toBe(true);
  });

  it('does not report time usage for core files without Date references', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(root, 'packages/core/src/pure.ts', 1, 'const value = 1;');

    expect(analyzeFile(absolutePath, root).hasTimeUsage).toBe(false);
  });

  it('ignores Date.now usage outside packages/core and packages/solver', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(root, 'apps/web/app/time.ts', 1, 'const now = Date.now();');

    expect(analyzeFile(absolutePath, root).hasTimeUsage).toBe(false);
  });

  it('sorts analyzeAll results by repo-relative path', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const later = writeLines(root, 'packages/shared/src/zeta.ts', 1);
    const earlier = writeLines(root, 'packages/shared/src/alpha.ts', 1);

    expect(analyzeAll([later, earlier], root).map((record) => record.path)).toEqual([
      'packages/shared/src/alpha.ts',
      'packages/shared/src/zeta.ts',
    ]);
  });

  it('reports zero lines for empty files', () => {
    const root = createTempRoot();
    tempRoots.push(root);
    const absolutePath = writeLines(root, 'packages/core/src/empty.ts', 0, '');

    const record = analyzeFile(absolutePath, root);
    expect(record.lines).toBe(0);
    expect(record.sizeStatus).toBe('P');
  });
});
