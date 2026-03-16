import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const eslintBin = path.join(repoRoot, 'node_modules', 'eslint', 'bin', 'eslint.js');

type EslintResult = { status: number | null; stdout: string; stderr: string };

function runEslint(source: string, filename: string): EslintResult {
  const result = spawnSync(process.execPath, [eslintBin, '--stdin', '--stdin-filename', filename], {
    cwd: repoRoot,
    input: source,
    encoding: 'utf8',
  });

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function combinedOutput(result: EslintResult): string {
  return `${result.stdout}\n${result.stderr}`;
}

describe('eslint security rules', () => {
  it('blocks error identifiers in json payloads', () => {
    const result = runEslint(
      "const error = new Error('boom'); Response.json({ message: error });",
      'apps/web/app/routes/tmp.ts',
    );

    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain('Do not pass raw error objects');
  });

  it('blocks error.message in json payloads', () => {
    const result = runEslint(
      "const error = new Error('boom'); Response.json({ message: error.message });",
      'apps/web/app/routes/tmp.ts',
    );

    expect(result.status).toBe(1);
    expect(combinedOutput(result)).toContain('Do not expose error.message');
  });

  it('allows new Function in theme tests only', () => {
    const allowed = runEslint(
      "new Function('return 1');",
      'apps/web/app/theme/__tests__/tmp.test.ts',
    );
    expect(allowed.status).toBe(0);

    const disallowed = runEslint("new Function('return 1');", 'apps/web/app/ui/tmp.test.ts');
    expect(disallowed.status).toBe(1);
    expect(combinedOutput(disallowed)).toContain('new Function() is banned');
  });
});
