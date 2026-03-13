import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { TextDecoder } from 'node:util';

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
const ignoredFiles = new Set([]);

const allowedNonAsciiByFile = new Map([
  [
    '.github/PULL_REQUEST_TEMPLATE.md',
    new Set([String.fromCodePoint(0x2705), String.fromCodePoint(0x274c)]),
  ],
]);

function resolveScanMode(argv, env) {
  const wantsStaged = argv.includes('--staged');
  const wantsTracked = argv.includes('--all') || argv.includes('--tracked');
  const wantsWorktree = argv.includes('--worktree');
  const requestedModes = [wantsStaged, wantsTracked, wantsWorktree].filter(Boolean).length;

  if (requestedModes > 1) {
    throw new Error('Choose only one of --staged, --tracked/--all, or --worktree.');
  }

  if (wantsStaged) {
    return 'staged';
  }

  if (wantsTracked || env.CI) {
    return 'tracked';
  }

  if (wantsWorktree) {
    return 'worktree';
  }

  return 'staged';
}

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

function getWorktreeFiles() {
  try {
    const output = execSync('git ls-files --cached --others --exclude-standard', {
      encoding: 'utf8',
    }).trim();
    return output ? Array.from(new Set(output.split(/\r?\n/))) : [];
  } catch {
    return [];
  }
}

function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { encoding: 'utf8' }).trim();
    return output ? output.split(/\r?\n/) : [];
  } catch {
    return [];
  }
}

function isIgnoredPath(filePath) {
  return (
    ignoredFiles.has(filePath) || ignoredPrefixes.some((prefix) => filePath.startsWith(prefix))
  );
}

function isBinaryExtension(filePath) {
  return binaryExtensions.has(path.extname(filePath).toLowerCase());
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
}

function decodeUtf8(buffer, filePath) {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return decoder.decode(buffer);
  } catch (error) {
    return { error: `${filePath}: invalid UTF-8 encoding (${error?.message ?? 'decode failed'})` };
  }
}

function findInvalidAsciiByte(buffer) {
  for (let index = 0; index < buffer.length; index += 1) {
    const value = buffer[index];
    const isAllowed = value === 9 || value === 10 || value === 13 || (value >= 32 && value <= 126);
    if (!isAllowed) {
      return { index, value };
    }
  }
  return null;
}

const scanMode = resolveScanMode(process.argv, process.env);
const filesToCheck =
  scanMode === 'staged'
    ? getStagedFiles()
    : scanMode === 'tracked'
      ? getTrackedFiles()
      : getWorktreeFiles();
const errors = [];

for (const filePath of filesToCheck) {
  if (isIgnoredPath(filePath) || isBinaryExtension(filePath)) {
    continue;
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    continue;
  }

  if (!stats.isFile()) {
    continue;
  }

  const buffer = readFileSync(filePath);

  if (buffer.includes(0)) {
    continue;
  }

  if (hasUtf8Bom(buffer)) {
    errors.push(`${filePath}: UTF-8 BOM detected`);
    continue;
  }

  const invalidByte = findInvalidAsciiByte(buffer);
  if (!invalidByte) {
    continue;
  }

  const decoded = decodeUtf8(buffer, filePath);
  if (typeof decoded === 'object' && decoded.error) {
    errors.push(decoded.error);
    continue;
  }

  const allowed = allowedNonAsciiByFile.get(filePath) ?? new Set();
  for (const char of decoded) {
    if (char <= '\u007f') {
      continue;
    }
    if (!allowed.has(char)) {
      const codePoint = char.codePointAt(0)?.toString(16).toUpperCase() ?? 'UNKNOWN';
      errors.push(`${filePath}: disallowed non-ASCII character U+${codePoint}`);
      break;
    }
  }
}

if (errors.length > 0) {
  console.error('Encoding policy check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

const scope =
  scanMode === 'staged'
    ? 'staged files'
    : scanMode === 'tracked'
      ? 'all tracked files'
      : 'worktree files';
console.log(`Encoding policy check passed (${scope}).`);
