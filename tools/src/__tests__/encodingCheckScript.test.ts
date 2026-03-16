import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('../../scripts/encoding-check.mjs', import.meta.url));
const tempDirs: string[] = [];

function runCommand(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function runEncodingCheck(repoDir: string, args: string[]) {
  return runCommand(process.execPath, [scriptPath, ...args], repoDir);
}

function runEncodingCheckWithEnv(repoDir: string, args: string[], env: NodeJS.ProcessEnv) {
  return runCommand(process.execPath, [scriptPath, ...args], repoDir, env);
}

function initializeRepo(): string {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), 'corgiban-encoding-check-'));
  tempDirs.push(repoDir);
  mkdirSync(path.join(repoDir, 'src'), { recursive: true });

  expect(runCommand('git', ['init'], repoDir).status).toBe(0);
  expect(runCommand('git', ['config', 'user.email', 'test@example.com'], repoDir).status).toBe(0);
  expect(runCommand('git', ['config', 'user.name', 'Test User'], repoDir).status).toBe(0);

  writeFileSync(path.join(repoDir, 'src', 'tracked.txt'), 'plain ascii\n', 'utf8');
  expect(runCommand('git', ['add', '.'], repoDir).status).toBe(0);
  expect(runCommand('git', ['commit', '-m', 'init'], repoDir).status).toBe(0);

  return repoDir;
}

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => {
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('encoding-check script modes', () => {
  it('checks only staged files in staged mode', () => {
    const repoDir = initializeRepo();

    writeFileSync(path.join(repoDir, 'src', 'staged-bad.txt'), 'bad \u2713\n', 'utf8');
    expect(runCommand('git', ['add', 'src/staged-bad.txt'], repoDir).status).toBe(0);

    const result = runEncodingCheck(repoDir, ['--staged']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/staged-bad.txt: disallowed non-ASCII character U+2713');
  });

  it('checks committed tracked files in tracked mode', () => {
    const repoDir = initializeRepo();

    writeFileSync(path.join(repoDir, 'src', 'tracked-bad.txt'), 'bad \u2713\n', 'utf8');
    expect(runCommand('git', ['add', 'src/tracked-bad.txt'], repoDir).status).toBe(0);
    expect(runCommand('git', ['commit', '-m', 'tracked bad'], repoDir).status).toBe(0);

    const result = runEncodingCheck(repoDir, ['--tracked']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('src/tracked-bad.txt: disallowed non-ASCII character U+2713');
  });

  it('checks untracked files in worktree mode', () => {
    const repoDir = initializeRepo();

    writeFileSync(path.join(repoDir, 'src', 'untracked-bad.txt'), 'bad \u2713\n', 'utf8');

    const trackedOnlyResult = runEncodingCheck(repoDir, ['--tracked']);
    expect(trackedOnlyResult.status).toBe(0);
    expect(trackedOnlyResult.stdout).toContain('Encoding policy check passed (all tracked files).');

    const worktreeResult = runEncodingCheck(repoDir, ['--worktree']);
    expect(worktreeResult.status).toBe(1);
    expect(worktreeResult.stderr).toContain(
      'src/untracked-bad.txt: disallowed non-ASCII character U+2713',
    );
  });

  it('prefers explicit worktree mode over CI default tracked mode', () => {
    const repoDir = initializeRepo();

    writeFileSync(path.join(repoDir, 'src', 'ci-untracked-bad.txt'), 'bad \u2713\n', 'utf8');

    const result = runEncodingCheckWithEnv(repoDir, ['--worktree'], { CI: '1' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'src/ci-untracked-bad.txt: disallowed non-ASCII character U+2713',
    );
  });
});
