import { execSync, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const pnpmCommand = isWindows ? 'cmd.exe' : 'pnpm';
const pnpmArgsPrefix = isWindows ? ['/d', '/s', '/c', 'pnpm'] : [];

function getStagedFiles() {
  try {
    const output = execSync('git diff --name-only --cached --diff-filter=ACMRTUXB', {
      encoding: 'utf8',
    }).trim();
    return output ? output.split(/\r?\n/) : [];
  } catch {
    return [];
  }
}

function isCodeChange(filePath) {
  if (filePath.startsWith('docs/')) return false;
  if (filePath.endsWith('.md')) return false;

  if (
    filePath.startsWith('apps/') ||
    filePath.startsWith('packages/') ||
    filePath.startsWith('tools/')
  ) {
    return true;
  }

  if (!filePath.includes('/')) {
    return /\.(js|jsx|ts|tsx|mjs|cjs|json|yaml|yml)$/.test(filePath);
  }

  return false;
}

function runCommand(command, args) {
  const result = spawnSync(command, [...pnpmArgsPrefix, ...args], { stdio: 'inherit' });
  if (result.status !== 0) {
    if (result.error) {
      console.error(result.error.message);
    }
    process.exit(result.status ?? 1);
  }
}

const stagedFiles = getStagedFiles();

runCommand(pnpmCommand, ['lint']);

if (stagedFiles.length === 0) {
  console.log('No staged files detected. Skipping affected tests.');
  process.exit(0);
}

const shouldRunTests = stagedFiles.some(isCodeChange);

if (!shouldRunTests) {
  console.log('No affected code paths detected. Skipping affected tests.');
  process.exit(0);
}

runCommand(pnpmCommand, ['test']);
