import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { formatCoverageReport, parseCoverageFinal } from '../src/coverageFormatter';

const COVERAGE_FINAL_PATH = path.resolve('coverage/coverage-final.json');

type CoverageFinalJson = Parameters<typeof parseCoverageFinal>[0];

function runCoverageCommand(): void {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'pnpm';
  const args = isWindows
    ? [
        '/d',
        '/s',
        '/c',
        'pnpm exec vitest run --coverage --coverage.all false --coverage.reporter=json --coverage.reporter=html --workspace vitest.workspace.ts',
      ]
    : [
        'exec',
        'vitest',
        'run',
        '--coverage',
        '--coverage.all',
        'false',
        '--coverage.reporter=json',
        '--coverage.reporter=html',
        '--workspace',
        'vitest.workspace.ts',
      ];

  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function readCoverageSummary(): Promise<CoverageFinalJson> {
  const content = await readFile(COVERAGE_FINAL_PATH, 'utf8');
  return JSON.parse(content) as CoverageFinalJson;
}

export async function run(): Promise<void> {
  runCoverageCommand();

  const coverageJson = await readCoverageSummary();
  const { total, files } = parseCoverageFinal(coverageJson, process.cwd());
  const report = formatCoverageReport(total, files);
  console.log('');
  console.log(report);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  run().catch((error) => {
    console.error('coverage report command failed:', error);
    process.exitCode = 1;
  });
}
