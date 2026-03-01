import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

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
const ignoredFiles = new Set(['.github/PULL_REQUEST_TEMPLATE.md']);

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

const stagedFiles = getStagedFiles();
const errors = [];

for (const filePath of stagedFiles) {
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
  if (invalidByte) {
    errors.push(`${filePath}: non-ASCII byte 0x${invalidByte.value.toString(16)}`);
  }
}

if (errors.length > 0) {
  console.error('Encoding policy check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Encoding policy check passed.');
