import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { normalizeAsciiText } from '../src/normalizeAsciiText';

const binaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.bmp',
  '.pdf',
  '.zip',
  '.gz',
  '.7z',
  '.tar',
  '.rar',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp3',
  '.mp4',
  '.wav',
  '.ogg',
]);

const ignoredPrefixes = [
  'node_modules/',
  'dist/',
  'dist-types/',
  'build/',
  'coverage/',
  'artifacts/',
  'docs/_generated/',
];

type NormalizeAsciiOptions = {
  scanAll: boolean;
  scanStaged: boolean;
  explicitPaths: string[];
};

function parseOptions(argv: string[]): NormalizeAsciiOptions {
  const scanAll = argv.includes('--all');
  const scanStaged = scanAll ? false : argv.includes('--staged') || argv.length === 0;
  const explicitPaths = argv.filter((arg) => !arg.startsWith('--'));

  return {
    scanAll,
    scanStaged,
    explicitPaths,
  };
}

function getRepoFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  }).trim();
  return output.length > 0 ? output.split(/\r?\n/) : [];
}

function getStagedFiles(): string[] {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--cached', '--diff-filter=ACMRTUXB'],
    {
      encoding: 'utf8',
    },
  ).trim();
  return output.length > 0 ? output.split(/\r?\n/) : [];
}

function resolveInputPaths(options: NormalizeAsciiOptions): string[] {
  if (options.explicitPaths.length > 0) {
    return options.explicitPaths;
  }

  if (options.scanAll) {
    return getRepoFiles();
  }

  if (options.scanStaged) {
    return getStagedFiles();
  }

  return [];
}

function isIgnoredPath(filePath: string): boolean {
  return ignoredPrefixes.some((prefix) => filePath.startsWith(prefix));
}

function isBinaryPath(filePath: string): boolean {
  return binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function canNormalizeFile(filePath: string): boolean {
  if (isIgnoredPath(filePath) || isBinaryPath(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  return stats.isFile();
}

function normalizeFile(filePath: string): boolean {
  const source = readFileSync(filePath, 'utf8');
  const normalized = normalizeAsciiText(source);
  if (!normalized.changed) {
    return false;
  }

  writeFileSync(filePath, normalized.text, 'utf8');
  return true;
}

function restageFiles(paths: string[]): void {
  if (paths.length === 0) {
    return;
  }

  execFileSync('git', ['add', '--', ...paths], { stdio: 'inherit' });
}

export function run(argv: string[] = process.argv.slice(2)): void {
  const options = parseOptions(argv);
  const paths = resolveInputPaths(options);
  const changedFiles: string[] = [];

  paths.forEach((filePath) => {
    try {
      if (!canNormalizeFile(filePath)) {
        return;
      }

      if (normalizeFile(filePath)) {
        changedFiles.push(filePath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw error;
    }
  });

  if (options.scanStaged) {
    restageFiles(changedFiles);
  }

  if (changedFiles.length === 0) {
    console.log('ASCII normalization made no changes.');
    return;
  }

  console.log(`ASCII normalization updated ${changedFiles.length} file(s).`);
}

run();
