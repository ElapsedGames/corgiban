import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SizeStatus = 'P' | 'W' | 'F';

export type FileRecord = {
  path: string;
  lines: number;
  sizeStatus: SizeStatus;
  hasTimeUsage: boolean;
};

function toPosixRelativePath(root: string, absolutePath: string): string {
  return path.relative(root, absolutePath).split(path.sep).join('/');
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

function getSizeStatus(lines: number): SizeStatus {
  if (lines <= 500) {
    return 'P';
  }
  if (lines <= 800) {
    return 'W';
  }
  return 'F';
}

function isDeterministicScope(relativePath: string): boolean {
  return (
    relativePath.startsWith('packages/core/src/') || relativePath.startsWith('packages/solver/src/')
  );
}

function detectTimeUsage(content: string): boolean {
  return /\bDate\.now\s*\(|\bnew\s+Date\s*\(|\bDate\s*\(/.test(content);
}

export function analyzeFile(absolutePath: string, root: string): FileRecord {
  const content = readFileSync(absolutePath, 'utf8');
  const relativePath = toPosixRelativePath(root, absolutePath);
  const lines = countLines(content);

  return {
    path: relativePath,
    lines,
    sizeStatus: getSizeStatus(lines),
    hasTimeUsage: isDeterministicScope(relativePath) ? detectTimeUsage(content) : false,
  };
}

export function analyzeAll(paths: string[], root: string): FileRecord[] {
  return paths
    .map((absolutePath) => analyzeFile(absolutePath, root))
    .sort((left, right) => left.path.localeCompare(right.path));
}
