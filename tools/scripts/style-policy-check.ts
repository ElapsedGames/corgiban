import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import {
  STYLE_GUIDE_PATH,
  detectStyleViolations,
  isStyleRelevantFile,
} from '../src/stylePolicyCheck';

const scanAll = process.argv.includes('--all') || Boolean(process.env.CI);

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

function getTrackedFiles() {
  try {
    const output = execSync('git ls-files', { encoding: 'utf8' }).trim();
    return output ? output.split(/\r?\n/) : [];
  } catch {
    return [];
  }
}

function readTextFile(filePath: string): string | null {
  try {
    return readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

const filesToCheck = scanAll ? getTrackedFiles() : getStagedFiles();
const relevantFiles = filesToCheck.flatMap((filePath) => {
  const content = readTextFile(filePath);
  if (content === null) {
    return [];
  }

  return isStyleRelevantFile(filePath, content) ? [{ filePath, content }] : [];
});

if (relevantFiles.length === 0) {
  console.log('Style policy check: no staged style-related files detected.');
  process.exit(0);
}

console.log(`Style policy check: review ${STYLE_GUIDE_PATH}`);

const errors = relevantFiles.flatMap(({ filePath, content }) => {
  const violations = detectStyleViolations(filePath, content);
  return violations.map((message) => `${filePath}: ${message}`);
});

if (errors.length > 0) {
  console.error('Style policy check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Style policy check passed for ${relevantFiles.length} file(s).`);
